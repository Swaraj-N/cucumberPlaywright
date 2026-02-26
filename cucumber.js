module.exports = {
  default: {
    require: [
      "src/step-definitions/*.ts",
      "src/hooks/*.ts"
    ],
    requireModule: ["ts-node/register"],
    format: [
      "progress",
      "junit:reports/results.xml"
    ],
    paths: ["src/features/*.feature"]
  }
};