export type InputName = string;
export type Variant   = string;
export type Encoding  = 'utf8' | 'utf-8' | 'ascii' | 'base64' | 'binary' | 'hex' | 'latin1' | 'ucs-2' | 'ucs2' | 'utf16le';

export type Path = string;

export interface Config {
    name?: InputName;
    outputName?: string;
    encoding?: Encoding;
    outPath?: string;
    default: Variant;
    fallbacks?: {
        [variant: string]: Variant;
    };
    useGlobalReplacements?: boolean | string[];
    marking?: boolean | string;
    exclude?: string;
}

export interface GlobalConfig {
    values?: {
        variant?: string;
    };
    options?: string[];
    overrides?: {
        marking?: boolean | string;
    };
}

export interface BuildInfo {
    name: InputName;
    outputName: string;
    encoding: string;
    destDir: string;
    srcDestPairs: [Path, Path][];
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
