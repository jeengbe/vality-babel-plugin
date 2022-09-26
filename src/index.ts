import { NodePath, PluginObj } from "@babel/core";
import * as t from "@babel/types";

export default (): PluginObj => ({
  name: "vality",
  visitor: {
    MemberExpression: visit,
    CallExpression: visit,
  },
});

function visit(path: NodePath<t.Node>) {
  switch (path.type) {
    case "MemberExpression":
      return visitMemberExpression(path as NodePath<t.MemberExpression>);
    case "CallExpression":
      return visitCallExpression(path as NodePath<t.CallExpression>);
  }
}

function visitMemberExpression(path: NodePath<t.MemberExpression>) {
  const { node } = path;
  if (isGuard(node)) {
    path.replaceWith(t.callExpression(node, [t.objectExpression([])]));
  } else if (isValit(node)) {
    path.replaceWith(t.callExpression(t.callExpression(node, []), [t.objectExpression([])]));
  }

  return path.skip();
}

function visitCallExpression(path: NodePath<t.CallExpression>) {
  const {
    node: { callee, arguments: args },
  } = path;

  if (isGuard(callee)) return path.skip();

  if (t.isCallExpression(callee)) {
    if (!isValit(callee.callee)) return path.skip();

    (path.get("callee").get("arguments") as NodePath<t.Node>[]).forEach((arg) =>
      visit(arg)
    );
    return path.skip();
  }

  path.replaceWith(t.callExpression(path.node, [t.objectExpression([])]));
  return path.skip();
}

function isValit(node: t.Node): boolean {
  return (
    t.isMemberExpression(node) &&
    t.isIdentifier(node.object) &&
    (node.object.name === "v" || node.object.name === "vality") &&
    t.isIdentifier(node.property) &&
    node.property.name === "array" // Here is where we would check for the type
  );
}

function isGuard(node: t.Node): boolean {
  return (
    t.isMemberExpression(node) &&
    t.isIdentifier(node.object) &&
    (node.object.name === "v" || node.object.name === "vality") &&
    t.isIdentifier(node.property) &&
    node.property.name === "number" // Here is where we would check for the type
  );
}
