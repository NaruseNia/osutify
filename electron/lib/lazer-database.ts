import { BrowserWindow, app } from "electron";
import { glob } from "glob";
import { join } from "node:path";
import Realm from "realm";

export class OsuLazerDatabase {
  private connection: Realm | null;
  private window: BrowserWindow | null;

  constructor(window: BrowserWindow | null = null) {
    this.connection = null;
    this.window = window || null;
  }

  private sendDebugData(data?: string) {
    if (this.window) {
      this.window.webContents.send("debug-data", data);
    }
  }

  public static async open(
    path: string,
    window: BrowserWindow | null = null,
  ): Promise<OsuLazerDatabase> {
    const db = new OsuLazerDatabase(window);
    console.log("Try to connect realm db...");
    db.sendDebugData("Try to connect realm db...");
    db.connection = await Realm.open({
      path,
      schema: [
        BeatmapSet,
        File,
        Beatmap,
        KeyBinding,
        Ruleset,
        BeatmapDifficulty,
        BeatmapMetadata,
        RealmNamedFileUsage,
        RealmUser,
        BeatmapUserSettings,
      ],
      schemaVersion: 41,
    });

    if (db) console.log("Connected to realm db.");

    return db;
  }

  public getConnection() {
    return this.connection;
  }

  public getObjects(type: string) {
    if (this.connection) {
      return this.connection.objects(type);
    } else {
      throw new Error("You should open connection at first.");
    }
  }

  public async getAsBeatmapData() {
    if (this.connection) {
      const data: OsuBeatmapData[] = [];
      let count = 0;

      for (const set of this.connection.objects(BeatmapSet)) {
        const first = set.Beatmaps.at(0);
        const files = set.Files;

        const audioHash = files.find(
          (f) => f.Filename == first?.Metadata.AudioFile,
        )?.File.Hash;
        const audioPaths: string[] = await glob
          .glob(
            `${join(
              app.getPath("appData"),
              "osu",
              "files",
            )}/${audioHash?.substring(0, 1)}/${audioHash?.substring(
              0,
              2,
            )}/${audioHash}`,
            { absolute: true },
          )
          .then((p: string[]) => p.map((p: string) => p.replace(/\\/g, "/")));

        const backgroundHash = files.find(
          (f) => f.Filename == first?.Metadata.BackgroundFile,
        )?.File.Hash;
        const backgroundPaths = await glob
          .glob(
            `${join(
              app.getPath("appData"),
              "osu",
              "files",
            )}/${backgroundHash?.substring(0, 1)}/${backgroundHash?.substring(
              0,
              2,
            )}/${backgroundHash}`,
            { absolute: true },
          )
          .then((p: string[]) => p.map((p: string) => p.replace(/\\/g, "/")));

        const extracted: OsuBeatmapData = {
          id: set.OnlineID,
          artist: first?.Metadata.Artist,
          artist_unicode: first?.Metadata.ArtistUnicode,
          title: first?.Metadata.Title,
          title_unicode: first?.Metadata.TitleUnicode,
          audio: first?.Metadata.AudioFile,
          audio_hash: audioHash,
          audio_path: audioPaths[0],
          background: first?.Metadata.BackgroundFile,
          background_hash: backgroundHash,
          background_path: backgroundPaths[0],
          hash: set.Hash,
          tags: first?.Metadata.Tags,
          total_time: first?.Length,
          bpm: first?.BPM,
        };

        count++;
        count % 50 == 0 &&
          this.sendDebugData(
            `Loading: ${extracted.title} (${count} / ${this.connection.objects(BeatmapSet).length})`,
          );
        console.log("Loaded: " + extracted.title);

        data.push(extracted);
      }

      this.sendDebugData("Data loaded.");
      return data;
    } else {
      throw new Error("You should open connection at first.");
    }
  }

  public close() {
    if (this.connection) this.connection.close();
  }
}

export type OsuBeatmapData = {
  id: number;
  artist: string | undefined;
  artist_unicode: string | undefined;
  title: string | undefined;
  title_unicode: string | undefined;
  hash: string | undefined;
  audio: string | undefined;
  audio_hash: string | undefined;
  audio_path: string | undefined;
  background: string | undefined;
  background_hash: string | undefined;
  background_path: string | undefined;
  tags: string | undefined;
  total_time: number | undefined;
  bpm: number | undefined;
};

export class Beatmap extends Realm.Object {
  Metadata!: BeatmapMetadata;
  Length!: number;
  BPM!: number;

  static schema: Realm.ObjectSchema = {
    name: "Beatmap",
    primaryKey: "ID",
    properties: {
      ID: "uuid",
      DifficultyName: "string?",
      Ruleset: "Ruleset",
      Difficulty: "BeatmapDifficulty",
      Metadata: "BeatmapMetadata",
      BeatmapSet: "BeatmapSet",
      UserSettings: "BeatmapUserSettings",
      Status: "int",
      Length: "double",
      BPM: "double",
      Hash: "string?",
      StarRating: "double",
      MD5Hash: "string?",
      OnlineMD5Hash: "string?",
      LastLocalUpdate: "date?",
      LastOnlineUpdate: "date?",
      EditorTimestamp: "double?",
      EndTimeObjectCount: "int",
      TotalObjectCount: "int",
      Hidden: "bool",
      AudioLeadIn: "double",
      StackLeniency: "float",
      SpecialStyle: "bool",
      LetterboxInBreaks: "bool",
      WidescreenStoryboard: "bool",
      EpilepsyWarning: "bool",
      SamplesMatchPlaybackRate: "bool",
      LastPlayed: "date?",
      DistanceSpacing: "double",
      BeatDivisor: "int",
      GridSize: "int",
      TimelineZoom: "double",
      OnlineID: { type: "int", indexed: true },
      CountdownOffset: "int",
    },
  };
}

export class BeatmapUserSettings extends Realm.Object {
  static schema: Realm.ObjectSchema = {
    name: "BeatmapUserSettings",
    embedded: true,
    properties: {
      Offset: "double",
    },
  };
}

export class BeatmapDifficulty extends Realm.Object {
  static schema: Realm.ObjectSchema = {
    name: "BeatmapDifficulty",
    embedded: true,
    properties: {
      DrainRate: "float",
      CircleSize: "float",
      OverallDifficulty: "float",
      ApproachRate: "float",
      SliderMultiplier: "double",
      SliderTickRate: "double",
    },
  };
}

export class BeatmapMetadata extends Realm.Object {
  Title!: string;
  TitleUnicode!: string;
  Artist!: string;
  ArtistUnicode!: string;
  Tags!: string;
  AudioFile!: string;
  BackgroundFile!: string;

  static schema: Realm.ObjectSchema = {
    name: "BeatmapMetadata",
    properties: {
      Title: "string?",
      TitleUnicode: "string?",
      Artist: "string?",
      ArtistUnicode: "string?",
      Source: "string?",
      Tags: "string?",
      PreviewTime: "int",
      AudioFile: "string?",
      BackgroundFile: "string?",
      Author: "RealmUser",
    },
  };
}

export class BeatmapSet extends Realm.Object {
  Beatmaps!: Beatmap[];
  OnlineID!: number;
  Hash!: string;
  Files!: RealmNamedFileUsage[];

  static schema: Realm.ObjectSchema = {
    name: "BeatmapSet",
    primaryKey: "ID",
    properties: {
      ID: "uuid",
      DateAdded: "date",
      DateSubmitted: "date?",
      DateRanked: "date?",
      Beatmaps: "Beatmap[]",
      Files: "RealmNamedFileUsage[]",
      DeletePending: "bool",
      Hash: "string?",
      Protected: "bool",
      OnlineID: { type: "int", indexed: true },
      Status: "int",
    },
  };
}

export class File extends Realm.Object<File> {
  Hash!: string;

  static schema: Realm.ObjectSchema = {
    name: "File",
    primaryKey: "Hash",
    properties: {
      Hash: "string?",
    },
  };
}

export class KeyBinding extends Realm.Object {
  static schema: Realm.ObjectSchema = {
    name: "KeyBinding",
    primaryKey: "ID",
    properties: {
      ID: "uuid",
      Variant: "int?",
      Action: "int",
      KeyCombination: "string?",
      RulesetName: "string?",
    },
  };
}

export class RealmNamedFileUsage extends Realm.Object {
  File!: File;
  Filename!: string;
  static schema: Realm.ObjectSchema = {
    name: "RealmNamedFileUsage",
    embedded: true,
    properties: {
      File: "File",
      Filename: "string?",
    },
  };
}

export class RealmUser extends Realm.Object {
  static schema: Realm.ObjectSchema = {
    name: "RealmUser",
    embedded: true,
    properties: {
      CountryCode: "string?",
      OnlineID: "int",
      Username: "string?",
    },
  };
}

export class Ruleset extends Realm.Object {
  static schema: Realm.ObjectSchema = {
    name: "Ruleset",
    primaryKey: "ShortName",
    properties: {
      LastAppliedDifficultyVersion: "int",
      ShortName: "string?",
      Name: "string?",
      InstantiationInfo: "string?",
      Available: "bool",
      OnlineID: { type: "int", indexed: true },
    },
  };
}

export class RulesetSetting extends Realm.Object {
  static schema: Realm.ObjectSchema = {
    name: "RulesetSetting",
    properties: {
      Variant: { type: "int", indexed: true },
      Key: "string",
      Value: "string",
      RulesetName: { type: "string", indexed: true },
    },
  };
}

export class Score extends Realm.Object {
  static schema: Realm.ObjectSchema = {
    name: "Score",
    primaryKey: "ID",
    properties: {
      ID: "uuid",
      BeatmapInfo: "Beatmap",
      Ruleset: "Ruleset",
      Files: "RealmNamedFileUsage[]",
      Hash: "string?",
      DeletePending: "bool",
      TotalScore: "int",
      MaxCombo: "int",
      Accuracy: "double",
      HasReplay: "bool",
      Date: "date",
      PP: "double?",
      OnlineID: { type: "int", indexed: true },
      User: "RealmUser",
      Mods: "string?",
      Statistics: "string?",
      Rank: "int",
      Combo: "int",
    },
  };
}

export class Skin extends Realm.Object {
  static schema: Realm.ObjectSchema = {
    name: "Skin",
    primaryKey: "ID",
    properties: {
      ID: "uuid",
      Name: "string?",
      Creator: "string?",
      InstantiationInfo: "string?",
      Hash: "string?",
      Protected: "bool",
      Files: "RealmNamedFileUsage[]",
      DeletePending: "bool",
    },
  };
}
