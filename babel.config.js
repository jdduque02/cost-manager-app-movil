// Solo en Jest: `import()` dinámico (p. ej. database.service.ts → expo-sqlite)
// exige --experimental-vm-modules; se reescribe a require() para que los
// jest.mock() funcionen sin ESM nativo.
const dynamicImportToRequire = ({ types: t }) => ({
  visitor: {
    CallExpression(path) {
      if (path.node.callee.type !== "Import") return;
      const req = t.callExpression(t.identifier("require"), path.node.arguments);
      path.replaceWith(
        t.callExpression(
          t.memberExpression(
            t.callExpression(t.memberExpression(t.identifier("Promise"), t.identifier("resolve")), []),
            t.identifier("then"),
          ),
          [t.arrowFunctionExpression([], req)],
        ),
      );
    },
  },
});

module.exports = function (api) {
  const isTest = api.env("test");
  api.cache.using(() => isTest);
  return {
    presets: [["babel-preset-expo", { jsxImportSource: "nativewind" }]],
    plugins: [...(isTest ? [dynamicImportToRequire] : []), "react-native-reanimated/plugin"],
  };
};
