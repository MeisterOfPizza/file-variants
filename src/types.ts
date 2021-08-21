export type FVName = string;
export type FVVariant = string;

export type FVConfigPath = string;
export type FVFilePath = string;

export interface FVConfig {
    name?: FVName;
    filename?: string;
    encoding?: string;
    outPath?: string;
    default: FVVariant;
    fallbacks?: {
        [variant: string]: FVVariant;
    };
    useGlobalReplaces?: boolean | string[];
}

export interface FVBuildInfo {
    name: FVName;
    filename: string;
    encoding: string;
    absoluteSrcPath: string;
    absoluteDestPath: string;
    config: FVConfig;
}

export interface FVOverrides {
    [name: string]: FVVariant;
}

export interface FVReplaces {
    [name: string]: {
        [keyword: string]: string;
    };
}

export interface FVGlobalReplaces {
    [keyword: string]: string;
}
