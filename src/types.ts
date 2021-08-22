export type InputName = string;
export type Variant = string;

export type ConfigPath = string;
export type OutputPath = string;

export interface Config {
    name?: InputName;
    filename?: string;
    encoding?: string;
    outPath?: string;
    default: Variant;
    fallbacks?: {
        [variant: string]: Variant;
    };
    useGlobalReplacements?: boolean | string[];
}

export interface BuildInfo {
    name: InputName;
    filename: string;
    encoding: string;
    absoluteSrcPath: string;
    absoluteDestPath: string;
    config: Config;
}

export interface Overrides {
    [name: string]: Variant;
}

export interface Replacements {
    [name: string]: {
        [keyword: string]: string;
    };
}

export interface GlobalReplacements {
    [keyword: string]: string;
}
