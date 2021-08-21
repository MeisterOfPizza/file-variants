import path from 'path';
import { glob } from 'glob';
import * as utils from './utils';
import * as T from './types';

const main = () => {
    const [,, ...args] = process.argv;
    let value_variant: T.FVVariant | null = null;
    const option_path           = path.resolve(process.cwd(), utils.consumeKeyValueArg(args, 'path') || '');
    const option_include        = utils.consumeKeyValueArg(args, 'include');
    const option_exclude        = utils.consumeKeyValueArg(args, 'exclude');
    const option_overrides      = utils.consumeAllKeyValueArgs(args, 'override-variant');
    const option_replaces       = utils.consumeAllKeyValueArgs(args, 'replace');
    const option_globalReplaces = utils.consumeAllKeyValueArgs(args, 'global-replace');
    const option_verbose        = utils.consumeFlagArg(args, 'verbose');
    if (args.length) {
        value_variant = args[0];
    }

    const includeNames = (option_include?.split(',') ?? []) as T.FVName[];
    const excludeNames = (option_exclude?.split(',') ?? []) as T.FVName[];

    const overrides = option_overrides.reduce((acc, nameVariantStr) => {
        const [name, variant] = nameVariantStr.split(',');
        acc[name] = variant;
        return acc;
    }, {} as T.FVOverrides);

    const replaces = option_replaces.reduce((acc, nameKeywordReplacmentStr) => {
        const [name, keyword, replacement] = nameKeywordReplacmentStr.split(',');
        if (!(name in acc)) {
            acc[name] = {};
        }
        acc[name][keyword] = replacement;
        return acc;
    }, {} as T.FVReplaces);

    const globalReplaces = option_globalReplaces.reduce((acc, keywordReplacmentStr) => {
        const [keyword, replacement] = keywordReplacmentStr.split(',');
        acc[keyword] = replacement;
        return acc;
    }, {} as T.FVGlobalReplaces);

    if (option_verbose) {
        utils.log();
        utils.log('Script "build" is running with the following values (and options*):');
        utils.log('variant =', value_variant);
        utils.log('path* =', option_path);
        utils.log('include* =', includeNames);
        utils.log('exclude* =', excludeNames);
        utils.log('overrides* =', overrides);
        utils.log('replaces* =', replaces);
        utils.log('global-replaces* =', globalReplaces);
        utils.log('verbose* =', option_verbose);
        utils.log();
    }

    glob(`${option_path}/**/${utils.CONFIG_FILENAME}`, (configGlobErr, configPaths) => {
        if (configGlobErr) {
            utils.logError('Searching for config files failed, reason:', configGlobErr);
        } else {
            configPaths.forEach((configPath) => {
                utils.build(
                    configPath,
                    value_variant,
                    includeNames,
                    excludeNames,
                    overrides,
                    replaces,
                    globalReplaces,
                    option_verbose,
                )
                    .then(({ name, absoluteDestPath }) => utils.logInstruction('Created file variant of', `"${name}"`, 'at', absoluteDestPath))
                    .catch((err) => utils.logError('Failed creating file variant, reason:', err))
                    .finally(() => {
                        if (option_verbose) {
                            utils.log();
                        }
                    });
            });
        }
    });
};

main();
