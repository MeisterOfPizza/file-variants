import path from 'path';
import fs from 'fs';
import { glob } from 'glob';
import chalk from 'chalk';
import * as T from './types';

export const CONFIG_FILENAME = 'fv.config.json';

const argsToStr = (...args: any[]): string => args.reduce((acc, a) => `${acc} ${a}`, '').substr(1);
const pathToStr = (p: string): string => chalk.gray(p);
export const log = (...args: any[]) => console.log(...args);
export const logInstruction = (...args: any[]) => console.log(chalk.cyan(`> ${argsToStr(...args)}`));
export const logSuccess = (...args: any[]) => console.log(chalk.green(`SUCCESS: ${argsToStr(...args)}`));
export const logWarning = (...args: any[]) => console.log(chalk.yellow(`WARN: ${argsToStr(...args)}`));
export const logError = (...args: any[]) => console.log(chalk.red(`ERR: ${argsToStr(...args)}`));

export const consumeFlagArg = (args: string[], flag: string): boolean => {
    const index = args.indexOf(flag);
    if (index !== -1) {
        args.splice(index, 1);
    }
    return index !== -1;
};

export const consumeKeyValueArg = (args: string[], key: string): string | null => {
    const pattern = `${key}=[^ ]*`;
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
    const pattern = `${key}=[^ ]*`;
    if (args && key) {
        for (let i = 0; i < args.length; i++) {
            const arg = args[i];
            if (arg.match(pattern)) {
                args.splice(i, 1);
                matches.push(arg.substr(key.length + 1));
            }
        }
    }
    return matches;
};

export const build = (
    configPath: T.FVConfigPath,
    variant: T.FVVariant | null,
    include: T.FVName[],
    exclude: T.FVName[],
    overrides: T.FVOverrides,
    replaces: T.FVReplaces,
    globalReplaces: T.FVGlobalReplaces,
    verbose: boolean,
) => new Promise<T.FVBuildInfo>((resolve, reject) => {
    getBuildInfo(configPath, variant, include, exclude, overrides, verbose)
        .then((buildInfo) => {
            buildFile(buildInfo, verbose)
                .then(() => {
                    replaceInFile(buildInfo, replaces, globalReplaces, verbose)
                        .then(() => resolve(buildInfo))
                        .catch(reject);
                })
        })
        .catch(reject);
});

const getBuildInfo = (
    configPath: T.FVConfigPath,
    variant: T.FVVariant | null,
    include: T.FVName[],
    exclude: T.FVName[],
    overrides: T.FVOverrides,
    verbose: boolean,
) => new Promise<T.FVBuildInfo>((resolve, reject) => {
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
                        } as T.FVBuildInfo);
                    })
                    .catch(reject);
            } else {
                reject(`Did not create file variant for "${name}" because it wasn't/was included/excluded.`);
            }
        })
        .catch(reject);
});

const getConfig = (
    configPath: T.FVConfigPath,
    verbose: boolean,
) => new Promise<T.FVConfig>((resolve, reject) => {
    if (verbose) {
        log('Running readFile at', pathToStr(configPath));
    }
    fs.promises.readFile(configPath, { encoding: 'utf8' })
        .then((data) => {
            if (verbose) {
                logSuccess(`readFile at ${pathToStr(configPath)} succeeded.`);
            }
            const config = JSON.parse(data) as T.FVConfig;
            resolve(config);
        })
        .catch((err) => {
            if (verbose) {
                logError(`readFile at ${pathToStr(configPath)} failed, reason: ${err}.`);
            }
            reject(`Reading config at ${pathToStr(configPath)} failed, reason: ${err}.`);
        });
});

const getSrcPath = (
    configPath: T.FVConfigPath,
    config: T.FVConfig,
    name: T.FVName,
    variant: T.FVVariant | null,
    overrides: T.FVOverrides,
    verbose: boolean,
) => new Promise<T.FVFilePath>((resolve, reject) => {
    glob(`${path.resolve(configPath, '..')}/*`, (err, filePaths) => {
        if (err) {
            if (verbose) {
                logError(`Searching for files at config "${name}" failed, reason: ${err}.`);
            }
            reject(`Searching for files at config "${name}" failed, reason: ${err}.`);
        } else {
            const variantsFound = filePaths
                .map((filePath) => ({ abs: filePath, ...path.parse(filePath) }))
                .filter(({ base }) => base !== CONFIG_FILENAME)
                .map(({ name: pathName, abs }) => ({ variantName: pathName, abs }));

            if (verbose) {
                log('Found variants', variantsFound.map(({ variantName }) => variantName), 'for config', `"${name}".`);
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
                reject(`Can't find a file variant to use for config "${name}".`);
            }
        }
    });
});

const buildFile = (
    buildInfo: T.FVBuildInfo,
    verbose: boolean,
) => new Promise((resolve, reject) => {
    const dirPath = path.resolve(buildInfo.absoluteDestPath, '..');
    if (verbose) {
        log(`Running mkdir (recursive) for ${pathToStr(dirPath)}.`);
    }
    fs.promises.mkdir(dirPath, { recursive: true })
        .then(() => {
            if (verbose) {
                logSuccess(`mkdir (recursive) for ${pathToStr(dirPath)} succeeded.`);
                log(`Running copyFile from ${pathToStr(buildInfo.absoluteSrcPath)} to ${pathToStr(buildInfo.absoluteDestPath)}.`);
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
                logError(`mkdir (recursive) for ${pathToStr(dirPath)} failed, reason: ${err}.`);
            }
            reject(`Can't create directory at ${pathToStr(dirPath)}, reason: ${err}.`);
        });
});

export const replaceInFile = (
    buildInfo: T.FVBuildInfo,
    replaces: T.FVReplaces,
    globalReplaces: T.FVGlobalReplaces,
    verbose: boolean,
) => new Promise((resolve, reject) => {
    const filePath = buildInfo.absoluteDestPath;
    const encoding = buildInfo.encoding;
    if (buildInfo.config.useGlobalReplaces || replaces[buildInfo.name]) {
        // @ts-ignore
        fs.promises.readFile(filePath, { encoding })
            .then((data) => {
                if (encoding === 'ascii'
                    || encoding === 'utf8'
                    || encoding === 'utf-8'
                    || encoding === 'latin1'
                    || encoding === 'utf16le') {
                    const foundReplacements = [];
                    // Add all file specific replaces:
                    if (buildInfo.name in replaces) {
                        foundReplacements.push(...Object.entries(replaces[buildInfo.name]));
                    }
                    // Add global replaces:
                    if (buildInfo.config.useGlobalReplaces) {
                        const globalReplaceEntries = Object.entries(globalReplaces);
                        if (buildInfo.config.useGlobalReplaces === true) {
                            foundReplacements.push(...globalReplaceEntries);
                        } else {
                            foundReplacements.push(
                                ...globalReplaceEntries.filter(([keyword]) => (
                                    buildInfo.config.useGlobalReplaces as string[]).includes(keyword)
                                )
                            );
                        }
                    }
                    // Replace all occurrences of keyword with replacement:
                    foundReplacements.forEach(([keyword, replacement]) => {
                        if (verbose) {
                            log(`Replaced "${keyword}" with "${replacement}" in ${pathToStr(filePath)}.`)
                        }
                        // @ts-ignore
                        data = data.replace(keyword, replacement);
                    });

                    fs.promises.writeFile(filePath, data, { encoding })
                        .then(() => {
                            if (verbose) {
                                logSuccess(`Completed ${foundReplacements.length} replacement(s) in copied file ${pathToStr(filePath)}.`);
                            }
                            resolve(null);
                        })
                        .catch((err) => {
                            reject(`Writing to copied file at ${pathToStr(filePath)} failed, reason: ${err}.`);
                        });
                } else {
                    resolve(null);
                }
            })
            .catch((err) => {
                if (verbose) {
                    logError(`readFile at ${pathToStr(filePath)} failed, reason: ${err}.`);
                }
                reject(`Reading from copied file at ${pathToStr(filePath)} failed, reason: ${err}.`);
            });
    } else {
        if (verbose) {
            log(`Did not replace in copied file ${pathToStr(filePath)}.`);
        }
        resolve(null);
    }
});
