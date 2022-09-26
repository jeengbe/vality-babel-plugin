/**
 * @type {import('jest').Config}
 */
const config = {
  coverageReporters: ["lcov"],
  verbose: true,
  transform: {
    "^.+\\.ts?$": "@swc/jest",
  },
};

module.exports = config;
