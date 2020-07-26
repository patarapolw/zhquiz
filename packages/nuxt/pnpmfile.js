const { resolutions } = JSON.parse(
  require("fs").readFileSync("./package.json", "utf-8")
);

if (resolutions) {
  module.exports = {
    hooks: {
      readPackage,
    },
  };

  function readPackage(pkg, context) {
    if (pkg.dependencies) {
      for (const k in resolutions) {
        if (pkg.dependencies[k] && pkg.dependencies[k] !== resolutions[k]) {
          context.log(
            `"${k}@${pkg.dependencies[k]}" overriden in "${pkg.name}" to "${k}@${resolutions[k]}"`
          );
          pkg.dependencies[k] = resolutions[k];
        }
      }
    }

    return pkg;
  }
} else {
  module.exports = {};
}