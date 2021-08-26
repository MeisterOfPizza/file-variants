import * as utils from '../src/utils';

test('uniqueBy', () => {
    expect(utils.uniqueBy([0, 1, 2, 3, 3])).toEqual([0, 1, 2, 3]);
    expect(utils.uniqueBy([0, 1, 2, 3, 3], (n) => n)).toEqual([0, 1, 2, 3]);
    expect(utils.uniqueBy([{ a: 0 }, { a: 1 }, { a: 0 }], (({ a }) => a))).toEqual([{ a: 0 }, { a: 1 }]);
});

test('consumeFlagArg', () => {
    expect(utils.consumeFlagArg([], 'foo')).toBeFalsy();
    expect(utils.consumeFlagArg(['foo'], 'foo')).toBeTruthy();
    expect(utils.consumeFlagArg(['foo'], 'boo')).toBeFalsy();
    expect(utils.consumeFlagArg(['foo=0'], 'foo')).toBeFalsy();
    expect(utils.consumeFlagArg(['foo', 'bar', 'x=0'], 'foo')).toBeTruthy();
    expect(utils.consumeFlagArg(['foo', 'bar', 'x=0'], 'bar')).toBeTruthy();
    expect(utils.consumeFlagArg(['foo', 'bar', 'x=0'], 'foobar')).toBeFalsy();
    expect(utils.consumeFlagArg(['foo', 'foobar', 'bar', 'x=0'], 'foobar')).toBeTruthy();
});

test('consumeKeyValueArg', () => {
    expect(utils.consumeKeyValueArg([], 'x')).toBeNull();
    expect(utils.consumeKeyValueArg(['foo', 'bar', 'x=0'], 'x')).toBe('0');
    expect(utils.consumeKeyValueArg(['foo', 'bar', 'x=0'], 'foo')).toBeNull();
    expect(utils.consumeKeyValueArg(['foo', 'bar', 'x=0'], 'boo')).toBeNull();

    expect(utils.consumeKeyValueArg(['foo', 'bar', 'x-y=foo bar buzz'], 'x-y')).toBe('foo bar buzz');

    const args0_0 = ['foo', 'bar', 'x=0', 'x=1'];
    const args0_1 = [...args0_0];
    expect(utils.consumeKeyValueArg(args0_0, 'x')).toBe('0');
    expect(args0_0).toEqual(['foo', 'bar', 'x=1']);
    expect(args0_0).not.toEqual(args0_1);

    const args1_0 = ['foo=0', 'foobar', 'foobar=1'];
    const args1_1 = [...args1_0];
    expect(utils.consumeKeyValueArg(args1_0, 'foobar')).toBe('1');
    expect(args1_0).toEqual(['foo=0', 'foobar']);
    expect(args1_0).not.toEqual(args1_1);
});

test('consumeAllKeyValueArgs', () => {
    expect(utils.consumeAllKeyValueArgs([], 'x')).toEqual([]);
    expect(utils.consumeAllKeyValueArgs(['foo', 'bar', 'x=0'], 'x')).toEqual(['0']);
    expect(utils.consumeAllKeyValueArgs(['foo', 'bar', 'y=1', 'x=0'], 'x')).toEqual(['0']);
    expect(utils.consumeAllKeyValueArgs(['foo', 'bar', 'x=0'], 'foo')).toEqual([]);
    expect(utils.consumeAllKeyValueArgs(['foo', 'bar', 'x=0'], 'boo')).toEqual([]);

    expect(utils.consumeAllKeyValueArgs(['x-y', 'foo', 'x-y=a', 'bar', 'x-y=foo bar buzz', 'x-y=a b'], 'x-y')).toEqual(['a', 'foo bar buzz', 'a b']);

    const args0 = ['foo', 'bar', 'x=0', 'x=1'];
    expect(utils.consumeAllKeyValueArgs(args0, 'x')).toEqual(['0', '1']);
    expect(args0).toEqual(['foo', 'bar']);

    const args1 = ['x=0', 'x=1'];
    expect(utils.consumeAllKeyValueArgs(args1, 'x')).toEqual(['0', '1']);
    expect(args1).toEqual([]);

    const args2_0 = ['foo=0', 'foo=1', 'foobar=2', 'bar=3', 'foo', 'foo=10'];
    const args2_1 = [...args2_0];
    expect(utils.consumeAllKeyValueArgs(args2_0, 'foo')).toEqual(['0', '1', '10']);
    expect(args2_0).toEqual(['foobar=2', 'bar=3', 'foo']);
    expect(args2_1).not.toEqual(args2_0);
});
