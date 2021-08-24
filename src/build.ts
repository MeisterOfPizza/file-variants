import path from 'path';
import { glob } from 'glob';
import * as utils from './utils';
import * as T from './types';

const main = () => {
    const [,, ...args] = process.argv;
    let valueVariant: T.Variant | null = null;
    const optionPath           = utils.consumeKeyValueArg(args, 'path');
    const optionConfigPath     = utils.consumeKeyValueArg(args, 'config');
    const optionInclude        = utils.consumeKeyValueArg(args, 'include');
    const optionExclude        = utils.consumeKeyValueArg(args, 'exclude');
    const optionOverrides      = utils.consumeAllKeyValueArgs(args, 'override');
    const optionReplaces       = utils.consumeAllKeyValueArgs(args, 'replace');
    const optionGlobalReplaces = utils.consumeAllKeyValueArgs(args, 'global-replace');
    const optionVerbose        = utils.consumeFlagArg(args, 'verbose');
    if (args.length) {
        valueVariant = args[0];
    }

    let globalConfig: T.GlobalConfig = {};

    if (optionConfigPath) {
        const absoluteGlobalConfigPath = path.resolve(process.cwd(), optionConfigPath);
        globalConfig = utils.getGlobalConfig(absoluteGlobalConfigPath) || {};
    }

    const gValueVariant         = globalConfig.values?.variant || null;
    const gOptionPath           = globalConfig.options && path.resolve(process.cwd(), utils.consumeKeyValueArg(globalConfig.options, 'path') || '');
    const gOptionInclude        = globalConfig.options && utils.consumeKeyValueArg(globalConfig.options, 'include');
    const gOptionExclude        = globalConfig.options && utils.consumeKeyValueArg(globalConfig.options, 'exclude');
    const gOptionOverrides      = globalConfig.options && utils.consumeAllKeyValueArgs(globalConfig.options, 'override');
    const gOptionReplaces       = globalConfig.options && utils.consumeAllKeyValueArgs(globalConfig.options, 'replace');
    const gOptionGlobalReplaces = globalConfig.options && utils.consumeAllKeyValueArgs(globalConfig.options, 'global-replace');
    const gOptionVerbose        = utils.consumeFlagArg(args, 'verbose');

    const realVariant: T.Variant | null = valueVariant || gValueVariant;
    const absolutePath = path.resolve(process.cwd(), optionPath || gOptionPath || '');

    const includeInputs = [
        ...(gOptionInclude?.split(',') ?? []),
        ...(optionInclude?.split(',') ?? []),
    ] as T.InputName[];

    const excludeInputs = [
        ...(gOptionExclude?.split(',') ?? []),
        ...(optionExclude?.split(',') ?? []),
    ] as T.InputName[];

    const overrides = [
        ...(gOptionOverrides || []),
        ...optionOverrides,
    ].reduce((acc, nameVariantStr) => {
        const [name, variant] = nameVariantStr.split(',');
        acc[name] = variant;
        return acc;
    }, {} as T.Overrides);

    const replacements = [
        ...(gOptionReplaces || []),
        ...optionReplaces,
    ].reduce((acc, nameKeywordReplacmentStr) => {
        const [name, keyword, replacement] = nameKeywordReplacmentStr.split(',');
        if (!(name in acc)) {
            acc[name] = {};
        }
        acc[name][keyword] = replacement;
        return acc;
    }, {} as T.Replacements);

    const globalReplacements = [
        ...(gOptionGlobalReplaces || []),
        ...optionGlobalReplaces,
    ].reduce((acc, keywordReplacmentStr) => {
        const [keyword, replacement] = keywordReplacmentStr.split(',');
        acc[keyword] = replacement;
        return acc;
    }, {} as T.GlobalReplacements);

    const verbose = optionVerbose || gOptionVerbose;

    if (verbose) {
        utils.log();
        utils.log('Script "build" is running with the following values (and options*):');
        utils.log('variant =', realVariant);
        utils.log('path* =', absolutePath);
        utils.log('include* =', includeInputs);
        utils.log('exclude* =', excludeInputs);
        utils.log('overrides* =', overrides);
        utils.log('replaces* =', replacements);
        utils.log('global-replaces* =', globalReplacements);
        utils.log('verbose* =', verbose);
        utils.log();
    }

    glob(`${absolutePath}/**/${utils.CONFIG_FILENAME}`, (configGlobErr, configPaths) => {
        if (configGlobErr) {
            utils.logError('Searching for config files failed, reason:', configGlobErr);
        } else {
            configPaths.forEach((configPath) => {
                utils.build(
                    configPath,
                    globalConfig,
                    realVariant,
                    includeInputs,
                    excludeInputs,
                    overrides,
                    replacements,
                    globalReplacements,
                    verbose,
                )
                    .then(({ name, srcDestPairs }) => utils.logInstruction(
                        `Created output(s) of input "${name}" at ${srcDestPairs.map(([, dest]) => utils.pathToStr(dest)).join(', ')}.`
                        ))
                    .catch((err) => utils.logError('Failed creating output, reason:', err))
                    .finally(() => {
                        if (verbose) {
                            utils.log();
                        }
                    });
            });
        }
    });
};

main();
