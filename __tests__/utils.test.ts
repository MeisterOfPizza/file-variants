import * as utils from '../src/utils';

test('consumeFlagArg', () => {
    expect(utils.consumeFlagArg([], 'foo')).toBeFalsy();
    expect(utils.consumeFlagArg(['foo'], 'foo')).toBeTruthy();
    expect(utils.consumeFlagArg(['foo'], 'boo')).toBeFalsy();
    expect(utils.consumeFlagArg(['foo', 'bar', 'x=0'], 'foo')).toBeTruthy();
    expect(utils.consumeFlagArg(['foo', 'bar', 'x=0'], 'bar')).toBeTruthy();
});

test('consumeKeyValueArg', () => {
    expect(utils.consumeKeyValueArg([], 'x')).toBeNull();
    expect(utils.consumeKeyValueArg(['foo', 'bar', 'x=0'], 'x')).toBe('0');
    expect(utils.consumeKeyValueArg(['foo', 'bar', 'x=0'], 'foo')).toBeNull();
    expect(utils.consumeKeyValueArg(['foo', 'bar', 'x=0'], 'boo')).toBeNull();
    const args0_0 = ['foo', 'bar', 'x=0', 'x=1'];
    const args0_1 = [...args0_0];
    expect(utils.consumeKeyValueArg(args0_0, 'x')).toBe('0');
    expect(args0_0).toEqual(['foo', 'bar', 'x=1']);
    expect(args0_0).not.toEqual(args0_1);
});

test('consumeAllKeyValueArgs', () => {
    expect(utils.consumeAllKeyValueArgs([], 'x')).toEqual([]);
    expect(utils.consumeAllKeyValueArgs(['foo', 'bar', 'x=0'], 'x')).toEqual(['0']);
    expect(utils.consumeAllKeyValueArgs(['foo', 'bar', 'y=1', 'x=0'], 'x')).toEqual(['0']);
    expect(utils.consumeAllKeyValueArgs(['foo', 'bar', 'x=0'], 'foo')).toEqual([]);
    expect(utils.consumeAllKeyValueArgs(['foo', 'bar', 'x=0'], 'boo')).toEqual([]);
    const args0 = ['foo', 'bar', 'x=0', 'x=1'];
    expect(utils.consumeAllKeyValueArgs(args0, 'x')).toEqual(['0', '1']);
    expect(args0).toEqual(['foo', 'bar']);
    const args1 = ['x=0', 'x=1'];
    expect(utils.consumeAllKeyValueArgs(args1, 'x')).toEqual(['0', '1']);
    expect(args1).toEqual([]);
});
