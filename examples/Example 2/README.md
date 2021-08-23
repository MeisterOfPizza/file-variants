* `npm run fv-build foo replace=colors,ALPHA_VALUE,0.5`
  * [colors.fvo.ini](./src/colors.fvo.ini) should have:
    * `primary=rgba(255, 0, 255, 0.5)`
    * `secondary=rgba(0, 255, 0, 0.5)`
* `npm run fv-build abc123`
  * [colors.fvo.ini](./src/colors.fvo.ini) should have:
    * `primary=EMPTY_COLORS_A`
    * `secondary=EMPTY_COLORS_A`
* `npm run fv-build foobar`
  * [colors.fvo.ini](./src/colors.fvo.ini) should have:
    * `primary=EMPTY_COLORS_A`
    * `secondary=EMPTY_COLORS_A`
* `npm run fv-build colors_c`
  * [colors.fvo.ini](./src/colors.fvo.ini) should have:
    * `primary=EMPTY_COLORS_C`
    * `secondary=EMPTY_COLORS_C`
