import path from 'path';
import { glob } from 'glob';
import * as utils from './utils';
import * as T from './types';

const main = () => {
    const [,, ...args] = process.argv;
    let valueVariant: T.Variant | null = null;
    const optionPath           = path.resolve(process.cwd(), utils.consumeKeyValueArg(args, 'path') || '');
    const optionInclude        = utils.consumeKeyValueArg(args, 'include');
    const optionExclude        = utils.consumeKeyValueArg(args, 'exclude');
    const optionOverrides      = utils.consumeAllKeyValueArgs(args, 'override-variant');
    const optionReplaces       = utils.consumeAllKeyValueArgs(args, 'replace');
    const optionGlobalReplaces = utils.consumeAllKeyValueArgs(args, 'global-replace');
    const optionVerbose        = utils.consumeFlagArg(args, 'verbose');
    if (args.length) {
        valueVariant = args[0];
    }

    const includeInputs = (optionInclude?.split(',') ?? []) as T.InputName[];
    const excludeInputs = (optionExclude?.split(',') ?? []) as T.InputName[];

    const overrides = optionOverrides.reduce((acc, nameVariantStr) => {
        const [name, variant] = nameVariantStr.split(',');
        acc[name] = variant;
        return acc;
    }, {} as T.Overrides);

    const replacements = optionReplaces.reduce((acc, nameKeywordReplacmentStr) => {
        const [name, keyword, replacement] = nameKeywordReplacmentStr.split(',');
        if (!(name in acc)) {
            acc[name] = {};
        }
        acc[name][keyword] = replacement;
        return acc;
    }, {} as T.Replacements);

    const globalReplacements = optionGlobalReplaces.reduce((acc, keywordReplacmentStr) => {
        const [keyword, replacement] = keywordReplacmentStr.split(',');
        acc[keyword] = replacement;
        return acc;
    }, {} as T.GlobalReplacements);

    if (optionVerbose) {
        utils.log();
        utils.log('Script "build" is running with the following values (and options*):');
        utils.log('variant =', valueVariant);
        utils.log('path* =', optionPath);
        utils.log('include* =', includeInputs);
        utils.log('exclude* =', excludeInputs);
        utils.log('overrides* =', overrides);
        utils.log('replaces* =', replacements);
        utils.log('global-replaces* =', globalReplacements);
        utils.log('verbose* =', optionVerbose);
        utils.log();
    }

    glob(`${optionPath}/**/${utils.CONFIG_FILENAME}`, (configGlobErr, configPaths) => {
        if (configGlobErr) {
            utils.logError('Searching for config files failed, reason:', configGlobErr);
        } else {
            configPaths.forEach((configPath) => {
                utils.build(
                    configPath,
                    valueVariant,
                    includeInputs,
                    excludeInputs,
                    overrides,
                    replacements,
                    globalReplacements,
                    optionVerbose,
                )
                    .then(({ name, absoluteDestPath }) => utils.logInstruction('Created output of input', `"${name}"`, 'at', absoluteDestPath))
                    .catch((err) => utils.logError('Failed creating output, reason:', err))
                    .finally(() => {
                        if (optionVerbose) {
                            utils.log();
                        }
                    });
            });
        }
    });
};

main();
