import path from 'path';
import fs from 'fs';
import { glob } from 'glob';
import chalk from 'chalk';
import * as T from './types';

const DEFAULT_MARKING = '.fvo';

export const CONFIG_FILENAME = 'fvi.config.json';

const argsToStr = (...args: any[]): string => args.reduce((acc, a) => `${acc} ${a}`, '').substr(1);
export const pathToStr = (p: string): string => chalk.gray(p);

export const log            = (...args: any[]) => console.log(...args);
export const logInstruction = (...args: any[]) => console.log(chalk.cyan(`> ${argsToStr(...args)}`));
export const logSuccess     = (...args: any[]) => console.log(chalk.green(`SUCCESS: ${argsToStr(...args)}`));
export const logWarning     = (...args: any[]) => console.log(chalk.yellow(`WARN: ${argsToStr(...args)}`));
export const logError       = (...args: any[]) => console.log(chalk.red(`ERR: ${argsToStr(...args)}`));

export const uniqueBy = <TSource, TSelected>(source: TSource[], selector: ((value: TSource) => TSelected) | null = null): TSource[] => {
    const lookup: TSelected[] = [];
    return source.reduce((acc, value) => {
        const selectedValue = (selector ? selector(value) : value) as TSelected;
        if (!lookup.includes(selectedValue)) {
            acc.push(value);
            lookup.push(selectedValue);
        }
        return acc;
    }, [] as TSource[]);
};

export const consumeFlagArg = (args: string[], flag: string): boolean => {
    const index = args.indexOf(flag);
    if (index !== -1) {
        args.splice(index, 1);
    }
    return index !== -1;
};

export const consumeKeyValueArg = (args: string[], key: string): string | null => {
    const pattern = `^${key}=[^ ]*$`;
    if (args && key) {
        for (let i = 0; i < args.length; i++) {
            const arg = args[i];
            if (arg.match(pattern)) {
                args.splice(i, 1);
                return arg.substr(key.length + 1);
            }
        }
    }
    return null;
};

export const consumeAllKeyValueArgs = (args: string[], key: string): string[] => {
    const matches = [];
    const pattern = `^${key}=[^ ]*$`;
    if (args && key) {
        const tmpArgs = [...args];
        for (let i = 0; i < tmpArgs.length; i++) {
            const arg = tmpArgs[i];
            if (arg.match(pattern)) {
                args.splice(i - (tmpArgs.length - args.length), 1);
                matches.push(arg.substr(key.length + 1));
            }
        }
    }
    return matches;
};

export const getGlobalConfig = (globalConfigPath: T.Path): T.GlobalConfig | null => {
    try {
        const data = fs.readFileSync(globalConfigPath, { encoding: 'utf8' });
        logInstruction(`Read global config at ${pathToStr(globalConfigPath)}.`);
        return JSON.parse(data) as T.GlobalConfig;
    } catch (err) {
        logError(`Can't read global config at ${pathToStr(globalConfigPath)}, reason: ${err}.`);
        return null;
    }
};

export const build = (
    configPath: T.Path,
    globalConfig: T.GlobalConfig,
    variant: T.Variant | null,
    include: T.InputName[],
    exclude: T.InputName[],
    overrides: T.Overrides,
    replacements: T.Replacements,
    globalReplacements: T.GlobalReplacements,
    verbose: boolean,
) => new Promise<T.BuildInfo>((resolve, reject) => {
    getBuildInfo(
        configPath,
        globalConfig,
        variant,
        include,
        exclude,
        overrides,
        verbose,
    )
        .then((buildInfo) => {
            buildOutputs(buildInfo, verbose)
                .then(() => {
                    replaceInOutputs(buildInfo, replacements, globalReplacements, verbose)
                        .then(() => resolve(buildInfo))
                        .catch(reject);
                })
        })
        .catch(reject);
});

const getBuildInfo = (
    configPath: T.Path,
    globalConfig: T.GlobalConfig,
    variant: T.Variant | null,
    include: T.InputName[],
    exclude: T.InputName[],
    overrides: T.Overrides,
    verbose: boolean,
) => new Promise<T.BuildInfo>((resolve, reject) => {
    getConfig(configPath, globalConfig, verbose)
        .then((config) => {
            const inputName = config.name || path.basename(path.resolve(configPath, '../'));
            if ((!include.length || include.includes(inputName)) && !exclude.includes(inputName)) {
                const encoding = config.encoding || 'utf8';
                getSrcPaths(configPath, config, inputName, variant, overrides, verbose)
                    .then((srcPaths) => {
                        let outputName = config.outputName || inputName;
                        if (outputName.includes('{name}')) {
                            outputName = outputName.replace('{name}', inputName);
                        }
                        if (config.marking) {
                            const marking = typeof config.marking === 'string' ? config.marking : DEFAULT_MARKING;
                            if (outputName.includes('{marking}')) {
                                outputName = outputName.replace('{marking}', marking);
                            } else {
                                outputName += marking;
                            }
                        }

                        const destDir = path.resolve(configPath, '..', config.outPath !== undefined ? config.outPath : '..');

                        const srcDestPairs = srcPaths.map((srcPath) => {
                            const extension = path.extname(srcPath);
                            const [, ...parts] = path.parse(srcPath).name.split('.');
                            let name = outputName;
                            parts.forEach((part, i) => {
                                const pattern = `{part${i}}`;
                                if (name.includes(pattern)) {
                                    name = name.replace(pattern, part);
                                }
                            });
                            return [srcPath, path.resolve(destDir, `${name}${extension}`)];
                        });

                        resolve({
                            name: inputName,
                            outputName,
                            encoding,
                            destDir,
                            srcDestPairs,
                            config,
                        } as T.BuildInfo);
                    })
                    .catch(reject);
            } else {
                reject(`Did not create output for "${inputName}" because it wasn't included / was excluded.`);
            }
        })
        .catch(reject);
});

const getConfig = (
    configPath: T.Path,
    globalConfig: T.GlobalConfig,
    verbose: boolean,
) => new Promise<T.Config>((resolve, reject) => {
    if (verbose) {
        log(`Running readFile of config at ${pathToStr(configPath)}.`);
    }
    fs.promises.readFile(configPath, { encoding: 'utf8' })
        .then((data) => {
            if (verbose) {
                logSuccess(`readFile of config at ${pathToStr(configPath)} succeeded.`);
            }
            const config = JSON.parse(data) as T.Config;
            resolve({
                ...globalConfig.overrides,
                ...config,
            } as T.Config);
        })
        .catch((err) => {
            if (verbose) {
                logError(`readFile of config at ${pathToStr(configPath)} failed, reason: ${err}.`)
            }
            reject(`Can't read config at ${pathToStr(configPath)}.`);
        });
});

const getSrcPaths = (
    configPath: T.Path,
    config: T.Config,
    inputName: T.InputName,
    variant: T.Variant | null,
    overrides: T.Overrides,
    verbose: boolean,
) => new Promise<T.Path[]>((resolve, reject) => {
    const searchPath = `${path.resolve(configPath, '..')}/*`;
    glob(searchPath, (err, fileVariantPaths) => {
        if (err) {
            if (verbose) {
                logError(`glob(${searchPath}) for files in input "${inputName}" failed, reason: ${err}.`);
            }
            reject(`Searching for files in input "${inputName}" failed, reason: ${err}.`);
        } else {
            const variantPathPairs = fileVariantPaths
                .map((fvp) => ({ absolute: fvp, ...path.parse(fvp) }))
                .filter(({ base }) => base !== CONFIG_FILENAME) // Because we get every file inside input, we need to exclude config from file variants
                .map(({ absolute, name }) => [name.split('.')[0], absolute] as [T.Variant, T.Path]);

            const variants = uniqueBy(variantPathPairs.map(([v]) => v));

            if (verbose) {
                if (variants.length > 0) {
                    log('Found variant(s)', variants.map((v) => `"${v}"`).join(', '), 'for input', `"${inputName}".`);
                } else {
                    logError(`Did not find any variants for input "${inputName}".`);
                }
            }

            let variantToUse = inputName in overrides ? overrides[inputName] : variant;
            // If overrides does not contain a variant override AND variant arg was not specified:
            if (!variantToUse) {
                variantToUse = config.default;
            } else if (config.fallbacks) {
                // Backup break to avoid infinite loops
                let maxLoopCount = 100;
                // Keep going until we either run into default OR we find a valid variant (or we break to stop infinite loops):
                while (maxLoopCount > 0 && variantToUse !== config.default && !variants.includes(variantToUse)) {
                    variantToUse = config.fallbacks[variantToUse];
                    maxLoopCount--;
                }
            }
            // If we still haven't found a valid variant, use default:
            if (!variants.includes(variantToUse)) {
                variantToUse = config.default;
            }

            const srcPaths = variantPathPairs
                .filter(([v]) => v === variantToUse)
                .map(([, p]) => p);

            if (srcPaths.length) {
                if (verbose) {
                    log(`Using variant "${variantToUse}" to build for input "${inputName}".`);
                }
                resolve(srcPaths);
            } else {
                reject(`Can't find a file variant to use for input "${inputName}".`);
            }
        }
    });
});

const buildOutputs = (
    buildInfo: T.BuildInfo,
    verbose: boolean,
) => new Promise((resolve, reject) => {
    const {
        destDir,
        srcDestPairs,
    } = buildInfo;
    if (verbose) {
        log(`Running mkdir (recursive) for output at ${pathToStr(destDir)}.`);
    }
    fs.promises.mkdir(destDir, { recursive: true })
        .then(() => {
            if (verbose) {
                logSuccess(`mkdir (recursive) for output at ${pathToStr(destDir)} succeeded.`);
            }
            let copyDoneCount    = 0;
            let copySuccessCount = 0;
            const handleCopyDone = (success: boolean) => {
                copyDoneCount++;
                if (success) {
                    copySuccessCount++;
                }
                if (copyDoneCount === srcDestPairs.length) {
                    if (copySuccessCount === copyDoneCount) {
                        resolve(null);
                    } else {
                        reject();
                    }
                }
            };
            srcDestPairs.forEach(([src, dest]) => {
                if (verbose) {
                    log(`Running copyFile (file-variant -> output) from ${pathToStr(src)} to ${pathToStr(dest)}.`);
                }
                fs.promises.copyFile(src, dest)
                    .then(() => {
                        if (verbose) {
                            logSuccess(`copyFile from ${pathToStr(src)} to ${pathToStr(dest)} succeeded.`);
                        }
                        handleCopyDone(true);
                    })
                    .catch(() => handleCopyDone(false));
            });
        })
        .catch((err) => {
            if (verbose) {
                logError(`mkdir (recursive) for output at ${pathToStr(destDir)} failed, reason: ${err}.`);
            }
            reject(`Can't create directory at ${pathToStr(destDir)}, reason: ${err}.`);
        });
});

export const replaceInOutputs = (
    buildInfo: T.BuildInfo,
    replacements: T.Replacements,
    globalReplacements: T.GlobalReplacements,
    verbose: boolean,
) => new Promise((resolve, reject) => {
    const {
        srcDestPairs,
    } = buildInfo;
    if (buildInfo.config.useGlobalReplacements || replacements[buildInfo.name]) {
        let replaceDoneCount    = 0;
        let replaceSuccessCount = 0;
        const handleReplaceDone = (success: boolean) => {
            replaceDoneCount++;
            if (success) {
                replaceSuccessCount++;
            }
            if (replaceDoneCount === srcDestPairs.length) {
                if (replaceSuccessCount === replaceDoneCount) {
                    resolve(null);
                } else {
                    reject();
                }
            }
        };
        srcDestPairs.forEach(([, dest]) => {
            replaceInOutput(dest, buildInfo, replacements, globalReplacements, verbose)
                .then(() => handleReplaceDone(true))
                .catch(() => handleReplaceDone(false));
        })
    } else {
        if (verbose) {
            log(`Did not replace in any output of input "${buildInfo.name}".`);
        }
        resolve(null);
    }
});

export const replaceInOutput = (
    destPath: T.Path,
    buildInfo: T.BuildInfo,
    replacements: T.Replacements,
    globalReplacements: T.GlobalReplacements,
    verbose: boolean,
) => new Promise((resolve, reject) => {
    const {
        encoding,
    } = buildInfo;
    if (verbose) {
        log(`Running readFile of output at ${pathToStr(destPath)}.`);
    }
    // @ts-ignore
    fs.promises.readFile(destPath, { encoding })
        .then((data) => {
            if (encoding === 'ascii'
                || encoding === 'utf8'
                || encoding === 'utf-8'
                || encoding === 'latin1') {
                if (verbose) {
                    log(`Trying to replace in output at ${pathToStr(destPath)}.`);
                }

                const foundReplacements = [];
                // Add all file specific replaces:
                if (buildInfo.name in replacements) {
                    foundReplacements.push(...Object.entries(replacements[buildInfo.name]));
                }
                // Add global replaces:
                if (buildInfo.config.useGlobalReplacements) {
                    const globalReplaceEntries = Object.entries(globalReplacements);
                    if (buildInfo.config.useGlobalReplacements === true) {
                        foundReplacements.push(...globalReplaceEntries);
                    } else {
                        foundReplacements.push(
                            ...globalReplaceEntries.filter(([keyword]) => (
                                buildInfo.config.useGlobalReplacements as string[]).includes(keyword)
                            )
                        );
                    }
                }
                let replacementCount = 0;
                // Replace all occurrences of keyword with replacement:
                foundReplacements.forEach(([keyword, replacement]) => {
                    const keywordRegExp = new RegExp(keyword, 'gm');
                    // @ts-ignore
                    if (keywordRegExp.test(data)) {
                        if (verbose) {
                            log(`Replaced "${keyword}" with "${replacement}" in output at ${pathToStr(destPath)}.`)
                        }
                        // @ts-ignore
                        data = data.replace(keywordRegExp, replacement);
                        replacementCount++;
                    }
                });

                fs.promises.writeFile(destPath, data, { encoding })
                    .then(() => {
                        if (verbose) {
                            logSuccess(`Completed ${replacementCount} replacement(s) in output at ${pathToStr(destPath)}.`);
                        }
                        resolve(null);
                    })
                    .catch((err) => {
                        if (verbose) {
                            logError(`writeFile to output at ${pathToStr(destPath)} failed, reason: ${err}.`);
                        }
                        reject(`Writing to output at ${pathToStr(destPath)} failed, reason: ${err}.`);
                    });
            } else {
                logWarning(`Did not replace in output at ${pathToStr(destPath)} because it had the wrong encoding (although still had valid replacements/global-replacements).`);
                resolve(null);
            }
        })
        .catch((err) => {
            if (verbose) {
                logError(`readFile of output at ${pathToStr(destPath)} failed, reason: ${err}.`);
            }
            reject(`Reading output of input "${buildInfo.name}" at ${pathToStr(destPath)} failed, reason: ${err}.`);
        });
});
