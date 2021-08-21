import path from 'path';
import { glob } from 'glob';
import * as utils from './utils';
import * as T from './types';

const main = () => {
    const [,, ...args] = process.argv;
    let valueVariant: T.FVVariant | null = null;
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

    const includeNames = (optionInclude?.split(',') ?? []) as T.FVName[];
    const excludeNames = (optionExclude?.split(',') ?? []) as T.FVName[];

    const overrides = optionOverrides.reduce((acc, nameVariantStr) => {
        const [name, variant] = nameVariantStr.split(',');
        acc[name] = variant;
        return acc;
    }, {} as T.FVOverrides);

    const replaces = optionReplaces.reduce((acc, nameKeywordReplacmentStr) => {
        const [name, keyword, replacement] = nameKeywordReplacmentStr.split(',');
        if (!(name in acc)) {
            acc[name] = {};
        }
        acc[name][keyword] = replacement;
        return acc;
    }, {} as T.FVReplaces);

    const globalReplaces = optionGlobalReplaces.reduce((acc, keywordReplacmentStr) => {
        const [keyword, replacement] = keywordReplacmentStr.split(',');
        acc[keyword] = replacement;
        return acc;
    }, {} as T.FVGlobalReplaces);

    if (optionVerbose) {
        utils.log();
        utils.log('Script "build" is running with the following values (and options*):');
        utils.log('variant =', valueVariant);
        utils.log('path* =', optionPath);
        utils.log('include* =', includeNames);
        utils.log('exclude* =', excludeNames);
        utils.log('overrides* =', overrides);
        utils.log('replaces* =', replaces);
        utils.log('global-replaces* =', globalReplaces);
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
                    includeNames,
                    excludeNames,
                    overrides,
                    replaces,
                    globalReplaces,
                    optionVerbose,
                )
                    .then(({ name, absoluteDestPath }) => utils.logInstruction('Created file variant of', `"${name}"`, 'at', absoluteDestPath))
                    .catch((err) => utils.logError('Failed creating file variant, reason:', err))
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
