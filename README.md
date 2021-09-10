<h1 style="text-align: center">file-variants</h1>

Sometimes you need to have multiple slightly different variants of the same file, say a different logo for each of your clients, but you want to keep your codebase to one single instance with smaller parts being switched out depending on client, platform, behaviour etc. (a sort of pseudo multitenancy). *file-variants* is an attempt to solve one part of this problem: using multiple file variants, but only building with one of them at a time.

## Installation
`npm install --save-dev file-variants`

## Running
### package.json
Add the following to your *package.json* file:
```json
{
  "scripts": {
    "fv-build": "file-variants build"
  }
}
```
### npm / npx
Now run `npm run fv-build` (or `npx file-variants build`)

## Contents
- [Installation](#installation)
- [Running](#running)
  - [package.json](#packagejson)
  - [npm / npx](#npm--npx)
- [Contents](#contents)
- [Usage](#usage)
- [Naming convention](#naming-convention)
- [Parts of a build](#parts-of-a-build)
  - [Input](#input)
  - [Config](#config)
  - [File variants](#file-variants)
  - [Output](#output)
- [Global config](#global-config)
- [Examples](#examples)
  - [Example 1](#example-1)
    - [1. Before build](#1-before-build)
    - [2. Build](#2-build)
    - [3. After build](#3-after-build)
  - [Example 2](#example-2)
    - [1. Before build](#1-before-build-1)
    - [2. Build](#2-build-1)
    - [3. After build](#3-after-build-1)
  - [Example 3](#example-3)
    - [1. Before build](#1-before-build-2)
    - [2. Build](#2-build-2)
    - [3. After build](#3-after-build-2)
- [License](#license)

## Usage
```bash
build
build [variant]

common options:
  path=path                          # specify path to search in (relative from cwd)
  config=path                        # specify path to global config (relative from cwd)
  include=[,input]                   # inputs to include
  exclude=[,input]                   # inputs to exclude
  override=input,variant             # override the variant for a specific input (repeatable)
  replace=input,keyword,replacement  # replacements for a specific input (repeatable)
  global-replace=keyword,replacement # replacements for all inputs (repeatable)
  verbose                            # debug info
```

## Naming convention
Because naming is difficult, please study the file structure below meant to represent the build of an imaginary logo image in order to understand what we've named the different parts of *file-variants*.
```
.
+-- _src
|   +-- _Logo               # input (directory)
|       +-- fvi.config.json # config
|       +-- foo.png         # file variant --\
|       +-- bar.png         # file variant ---|--> file variant*s*
|       +-- foobar.png      # file variant --/
|   +-- Logo.png            # output
|   ...
```

## Parts of a build
Here each part mentioned in [Naming convention](#naming-convention) will be explained.

### Input
* **type**: directory
* **purpose**: to contain a file-variant-input (fvi) config and all the file variants of this input.

### Config
* **type**: .json
* **purpose**: to provide values for *file-variants*.

> NOTE: Configs **must always** be named "fvi.config.json".

```ts
type Variant  = string;
type Encoding = 'utf8' | 'utf-8' | 'ascii' | 'base64' | 'binary' | 'hex' | 'latin1' | 'ucs-2' | 'ucs2' | 'utf16le';

interface Config {
  default: Variant;
  name?: string;
  outputName?: string;
  encoding?: Encoding;
  outPath?: string;
  fallbacks?: {
    [variant: Variant]: Variant;
  };
  useGlobalReplacements?: boolean | string[];
  marking?: boolean | string;
  exclude?: string;
}
```
* **default** (required): the default variant to use as fallback if all else fails.
* **name**: name of input. If left empty the input directory's name will be used instead.
* **outputName**: name of output (excluding extension). If left empty **name** will be used instead.
* **encoding**: common encoding of all file variants. If left empty, `utf8` will be used. However, **encoding** only matters if replacements are being used on the output. If replacements are provided and are to be used, **encoding** must be any of the following values: `ascii`, `utf8`, `utf-8`, or `latin1`.
* **outPath**: relative (from input's path) path to place output at.
  * Unprovided: output will be placed on the same level as input.
  * Empty: output will be placed inside input.
  * Otherwise: relative from path of input.
* **fallbacks**: a map of variant to variant fallbacks. If a variant isn't detected inside input, but is detected inside **fallbacks** as a key, the corresponding key's value will be used as the variant instead. This will be done recursively until a valid file variant is found, or until no fallbacks remain, in which case **default** will be used as a variant instead.
* **useGlobalReplacements**: control what keywords should be replaced by *global-replace(s)* (option).
  * Unprovided/false: output will not receive any replacements from *global-replace(s)*.
  * True: output will use replacements from all found global replaces.
  * Array: output will *only* use replacements found both in *global-replace(s)* *and* provided array.
* **marking**: mark the output to ignore changes more easily.
  * Unprovided/false: output will not be marked.
  * True: will append ".fvo" (not extension) to outputName.
  * String: will append given string to outputName OR replace keyword "{marking}" inside outputName.
* `exclude`: which file variants to exclude (regex). Matches entire filename (including variant).

### File variants
* **type**: .* (output will use the same extension as selected file variant)
* **purpose**: file variant.

### Output
* **type**: .* (same as selected file variant)
* **purpose**: to be used in your project.

## Global config
If you need many cli arguments when building, using a global config may be easier. You can specify which global config to use with the `config=[path]` argument passed to `build`.

Global configs **must always** be .json-files.

```ts
interface GlobalConfig {
  values?: {
    variant?: string;
  };
  options?: string[];
  overrides?: {
    marking?: boolean | string;
  };
}
```

## Examples
The files for each example can be found under [examples/](./examples).

### Example 1
You have 3 clients who use your product. You want to keep a shared codebase, where the only difference between these 3 clients is their logo.

#### 1. Before build
```
.
+-- _src
|   +-- _Logo
|       +-- fvi.config.json
|       +-- foo.png
|       +-- bar.png
|       +-- foobar.png
|   ...
```

#### 2. Build
`npm run fv-build foobar`

#### 3. After build
*Logo.png* is now a direct copy of *foobar.png*. You can now always import *Logo.png* instead of checking for the current client or doing lazy imports (which require you to build with all logos included).
```
.
+-- _src
|   +-- _Logo
|       +-- fvi.config.json
|       +-- foo.png
|       +-- bar.png
|       +-- foobar.png
|   +-- Logo.png # copy of src/Logo/foobar.png
|   ...
```

### Example 2
1. You use 3 different color.ini [variant-]files.
2. You build your project with variant *foo*.
3. You only have colors for *a*, *b*, and *c*.
4. Variant *foo* should **not** use *a* (default), but *b* as its fallback.

#### 1. Before build
```
.
+-- _src
|   +-- _colors
|       +-- fvi.config.json
|       +-- colors_a.ini
|       +-- colors_b.ini
|       +-- colors_c.ini
|   ...
```

fvi.config.json
```json
{
  "default": "colors_a",
  "fallbacks": {
    "foo": "colors_b"
  },
  "marking": true
}
```

colors_b.ini
```ini
[main]
primary=rgba(255, 0, 255, ALPHA_VALUE)
secondary=rgba(0, 255, 0, ALPHA_VALUE)
```
#### 2. Build
`npm run fv-build foo replace=colors,ALPHA_VALUE,0.5`

#### 3. After build
```
.
+-- _src
|   +-- _colors
|       +-- fvi.config.json
|       +-- colors_a.ini
|       +-- colors_b.ini
|       +-- colors_c.ini
|   +-- colors.fvo.ini # copy of src/colors/colors_b.ini
|   ...
```

colors.fvo.ini
```ini
[main]
primary=rgba(255, 0, 255, 0.5)
secondary=rgba(0, 255, 0, 0.5)
```

.gitignore
```.gitignore
# file-variants outputs
*.fvo*
```

### Example 3
1. You have 3 different splash image resolutions (64x64, 128x128, and 256x256).
2. Each variant has 3 resolutions (mentioned above).
3. You build your project with variant *red*.
4. You want the outputs to be named *splash_RESOLUTION.png*.

#### 1. Before build
```
.
+-- _src
|   +-- _splash
|       +-- fvi.config.json
|       +-- red.x64.png
|       +-- red.x128.png
|       +-- red.x256.png
|       +-- green.x64.png
|       +-- green.x128.png
|       +-- green.x256.png
|       +-- blue.x64.png
|       +-- blue.x128.png
|       +-- blue.x256.png
|   ...
```

fvi.config.json
```json
{
  "default": "red",
  // {part0} (pattern {part\d*}) means the first part of the
  // filename after variant (ie. red/green/blue in this case).
  "outputName": "{name}_{part0}"
}
```

#### 2. Build
`npm run fv-build`

#### 3. After build
```
.
+-- _src
|   +-- _splash
|       +-- fvi.config.json
|       +-- fvi.config.json
|       +-- red.x64.png
|       +-- red.x128.png
|       +-- red.x256.png
|       +-- green.x64.png
|       +-- green.x128.png
|       +-- green.x256.png
|       +-- blue.x64.png
|       +-- blue.x128.png
|       +-- blue.x256.png
|   +-- splash_x64.png
|   +-- splash_x128.png
|   +-- splash_x256.png
|   ...
```

.gitignore
```.gitignore
# file-variants outputs
splash*.png
```

## License
MIT. Copyright (c) 2021 Emil Engelin.
