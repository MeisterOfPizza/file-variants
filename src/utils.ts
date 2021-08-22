import path from 'path';
import fs from 'fs';
import { glob } from 'glob';
import chalk from 'chalk';
import * as T from './types';

export const CONFIG_FILENAME = 'fvi.config.json';

const argsToStr = (...args: any[]): string => args.reduce((acc, a) => `${acc} ${a}`, '').substr(1);
const pathToStr = (p: string): string => chalk.gray(p);

export const log            = (...args: any[]) => console.log(...args);
export const logInstruction = (...args: any[]) => console.log(chalk.cyan(`> ${argsToStr(...args)}`));
export const logSuccess     = (...args: any[]) => console.log(chalk.green(`SUCCESS: ${argsToStr(...args)}`));
export const logWarning     = (...args: any[]) => console.log(chalk.yellow(`WARN: ${argsToStr(...args)}`));
export const logError       = (...args: any[]) => console.log(chalk.red(`ERR: ${argsToStr(...args)}`));

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

export const build = (
    configPath: T.ConfigPath,
    variant: T.Variant | null,
    include: T.InputName[],
    exclude: T.InputName[],
    overrides: T.Overrides,
    replacements: T.Replacements,
    globalReplacements: T.GlobalReplacements,
    verbose: boolean,
) => new Promise<T.BuildInfo>((resolve, reject) => {
    getBuildInfo(configPath, variant, include, exclude, overrides, verbose)
        .then((buildInfo) => {
            buildOutput(buildInfo, verbose)
                .then(() => {
                    replaceInOutput(buildInfo, replacements, globalReplacements, verbose)
                        .then(() => resolve(buildInfo))
                        .catch(reject);
                })
        })
        .catch(reject);
});

const getBuildInfo = (
    configPath: T.ConfigPath,
    variant: T.Variant | null,
    include: T.InputName[],
    exclude: T.InputName[],
    overrides: T.Overrides,
    verbose: boolean,
) => new Promise<T.BuildInfo>((resolve, reject) => {
    getConfig(configPath, verbose)
        .then((config) => {
            const name = config.name || path.basename(path.resolve(configPath, '../'));
            if ((!include.length || include.includes(name)) && !exclude.includes(name)) {
                const filename = config.filename || name;
                const encoding = config.encoding || 'utf8';
                getSrcPath(configPath, config, name, variant, overrides, verbose)
                    .then((srcPath) => {
                        const extension = path.extname(srcPath);
                        const destPath  = path.resolve(configPath, '..', config.outPath !== undefined ? config.outPath : '..', `${filename}${extension}`);
                        resolve({
                            name,
                            filename,
                            encoding,
                            absoluteSrcPath: srcPath,
                            absoluteDestPath: destPath,
                            config,
                        } as T.BuildInfo);
                    })
                    .catch(reject);
            } else {
                reject(`Did not create output for "${name}" because it wasn't included / was excluded.`);
            }
        })
        .catch(reject);
});

const getConfig = (
    configPath: T.ConfigPath,
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
            resolve(config);
        })
        .catch((err) => {
            if (verbose) {
                logError(`readFile of config at ${pathToStr(configPath)} failed, reason: ${err}.`)
            }
            reject(`Can't read config at ${pathToStr(configPath)}.`);
        });
});

const getSrcPath = (
    configPath: T.ConfigPath,
    config: T.Config,
    name: T.InputName,
    variant: T.Variant | null,
    overrides: T.Overrides,
    verbose: boolean,
) => new Promise<T.OutputPath>((resolve, reject) => {
    const searchPath = `${path.resolve(configPath, '..')}/*`;
    glob(searchPath, (err, filePaths) => {
        if (err) {
            if (verbose) {
                logError(`glob(${searchPath}) for files in input "${name}" failed, reason: ${err}.`);
            }
            reject(`Searching for files in input "${name}" failed, reason: ${err}.`);
        } else {
            const variantsFound = filePaths
                .map((filePath) => ({ abs: filePath, ...path.parse(filePath) }))
                .filter(({ base }) => base !== CONFIG_FILENAME)
                .map(({ name: pathName, abs }) => ({ variantName: pathName, abs }));

            if (verbose) {
                log('Found variants', variantsFound.map(({ variantName }) => variantName), 'for input', `"${name}".`);
            }

            const variantNames = variantsFound.map(({ variantName }) => variantName);

            let variantToUse = name in overrides ? overrides[name] : variant;
            if (!variantToUse) {
                variantToUse = config.default;
            }
            if (config.fallbacks) {
                while (variantToUse !== config.default && !variantNames.includes(variantToUse)) {
                    variantToUse = config.fallbacks[variantToUse];
                }
            }
            if (!variantNames.includes(variantToUse)) {
                variantToUse = config.default;
            }

            if (variantToUse && variantsFound.find(({ variantName }) => variantName === variantToUse)) {
                const filePath = variantsFound.find(({ variantName }) => variantName === variantToUse)!.abs;
                resolve(filePath);
            } else {
                reject(`Can't find a file variant to use for input "${name}".`);
            }
        }
    });
});

const buildOutput = (
    buildInfo: T.BuildInfo,
    verbose: boolean,
) => new Promise((resolve, reject) => {
    const dirPath = path.resolve(buildInfo.absoluteDestPath, '..');
    if (verbose) {
        log(`Running mkdir (recursive) for output at ${pathToStr(dirPath)}.`);
    }
    fs.promises.mkdir(dirPath, { recursive: true })
        .then(() => {
            if (verbose) {
                logSuccess(`mkdir (recursive) for output at ${pathToStr(dirPath)} succeeded.`);
                log(`Running copyFile (file-variant -> output) from ${pathToStr(buildInfo.absoluteSrcPath)} to ${pathToStr(buildInfo.absoluteDestPath)}.`);
            }
            fs.promises.copyFile(buildInfo.absoluteSrcPath, buildInfo.absoluteDestPath)
                .then(() => {
                    if (verbose) {
                        logSuccess(`copyFile from ${pathToStr(buildInfo.absoluteSrcPath)} to ${pathToStr(buildInfo.absoluteDestPath)} succeeded.`);
                    }
                    resolve(null);
                })
                .catch(reject);
        })
        .catch((err) => {
            if (verbose) {
                logError(`mkdir (recursive) for output at ${pathToStr(dirPath)} failed, reason: ${err}.`);
            }
            reject(`Can't create directory at ${pathToStr(dirPath)}, reason: ${err}.`);
        });
});

export const replaceInOutput = (
    buildInfo: T.BuildInfo,
    replacements: T.Replacements,
    globalReplacements: T.GlobalReplacements,
    verbose: boolean,
) => new Promise((resolve, reject) => {
    const destPath = buildInfo.absoluteDestPath;
    const encoding = buildInfo.encoding;
    if (buildInfo.config.useGlobalReplacements || replacements[buildInfo.name]) {
        if (verbose) {
            log(`Running readFile of output at ${pathToStr(destPath)}.`);
        }
        // @ts-ignore
        fs.promises.readFile(destPath, { encoding })
            .then((data) => {
                if (encoding === 'ascii'
                    || encoding === 'utf8'
                    || encoding === 'utf-8'
                    || encoding === 'latin1'
                    || encoding === 'utf16le') {
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
                            reject(`writeFile to output at ${pathToStr(destPath)} failed, reason: ${err}.`);
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
    } else {
        if (verbose) {
            log(`Did not replace in output at ${pathToStr(destPath)}.`);
        }
        resolve(null);
    }
});
