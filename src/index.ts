import { NodePath, PluginObj } from "@babel/core";
import * as t from "@babel/types";

export default (): PluginObj => ({
  name: "vality",
  visitor: {
    MemberExpression: visitMemberExpression,
    CallExpression: visitCallExpression,
    ArrayExpression: visitArrayExpression,
    ObjectExpression: visitObjectExpression,
    StringLiteral: visitLiteral,
    NumericLiteral: visitLiteral,
    BooleanLiteral: visitLiteral,
    NullLiteral: visitLiteral,
  },
});

function visit(path: NodePath<t.Node>) {
  switch (path.type) {
    case "MemberExpression":
      return visitMemberExpression(path as NodePath<t.MemberExpression>);
    case "CallExpression":
      return visitCallExpression(path as NodePath<t.CallExpression>);
    case "ArrayExpression":
      return visitArrayExpression(path as NodePath<t.ArrayExpression>);
    case "ObjectExpression":
      return visitObjectExpression(path as NodePath<t.ObjectExpression>);
    case "StringLiteral":
    case "NumericLiteral":
    case "BooleanLiteral":
    case "NullLiteral":
      return visitLiteral(
        path as NodePath<
          t.StringLiteral | t.NumericLiteral | t.BooleanLiteral | t.NullLiteral
        >
      );
  }
}

function visitMemberExpression(path: NodePath<t.MemberExpression>) {
  const { node } = path;
  if (isGuard(node)) {
    path.replaceWith(t.callExpression(node, [t.objectExpression([])]));
  } else if (isValit(node)) {
    path.replaceWith(
      t.callExpression(t.callExpression(node, []), [t.objectExpression([])])
    );
  }

  return path.skip();
}

function visitCallExpression(path: NodePath<t.CallExpression>) {
  const {
    node: { callee },
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

function visitArrayExpression(path: NodePath<t.ArrayExpression>) {
  if (!containsValitOrGuard(path)) return path.skip();

  const { node } = path;

  if (node.elements.length === 1) {
    if (!node.elements[0] || node.elements[0].type === "SpreadElement")
      return path.skip();

    visit((path.get("elements") as NodePath<t.Node>[])[0]);

    path.replaceWith(
      t.callExpression(
        t.callExpression(
          // todo: import vality
          t.memberExpression(t.identifier("v"), t.identifier("array")),
          [node.elements[0]]
        ),
        [t.objectExpression([])]
      )
    );
  } else {
    for (let i = 0; i < node.elements.length; i++) {
      if (!node.elements[i] || node.elements[i]!.type === "SpreadElement")
        continue;

      visit((path.get("elements") as NodePath<t.Node>[])[i]);
    }

    path.replaceWith(
      t.callExpression(
        t.callExpression(
          t.memberExpression(t.identifier("v"), t.identifier("enum")),
          node.elements as t.Expression[]
        ),
        [t.objectExpression([])]
      )
    );
  }
  return path.skip();
}

function visitObjectExpression(path: NodePath<t.ObjectExpression>) {
  if (!containsValitOrGuard(path)) return path.skip();

  const { node } = path;

  for (let i = 0; i < node.properties.length; i++) {
    if (!node.properties[i]) continue;

    visit(
      (path.get("properties") as NodePath<t.Node>[])[i].get(
        "value"
      ) as NodePath<t.Node>
    );
  }

  path.replaceWith(
    t.callExpression(
      t.callExpression(
        t.memberExpression(t.identifier("v"), t.identifier("object")),
        [node]
      ),
      [t.objectExpression([])]
    )
  );
  return path.skip();
}

function containsValitOrGuard(path: NodePath<t.Node>): boolean {
  const { node } = path;

  switch (node.type) {
    case "ArrayExpression":
      return (path.get("elements") as NodePath<t.Node>[]).some((el) =>
        containsValitOrGuard(el)
      );
    case "ObjectExpression":
      return (path.get("properties") as NodePath<t.ObjectProperty>[]).some(
        (prop) => containsValitOrGuard(prop.get("value") as NodePath<t.Node>)
      );
    case "ObjectProperty":
      return containsValitOrGuard(path.get("value") as NodePath<t.Node>);
    case "CallExpression":
      return containsValitOrGuard(path.get("callee") as NodePath<t.Node>);
    case "MemberExpression":
      return isValit(node) || isGuard(node);
    default:
      return false;
  }
}

function visitLiteral(path: NodePath<t.StringLiteral | t.NumericLiteral | t.BooleanLiteral | t.NullLiteral>) {
  if (!parentContainsValitOrGuard(path)) return path.skip();

  path.replaceWith(
    t.callExpression(
      t.callExpression(
        t.memberExpression(t.identifier("v"), t.identifier("literal")),
        [path.node]
      ),
      [t.objectExpression([])]
    )
  );
  return path.skip();
}

function parentContainsValitOrGuard(path: NodePath<t.Node>): boolean {
  const { parentPath } = path;

  if (!parentPath) return false;

  switch (parentPath.type) {
    case "ArrayExpression":
      return containsValitOrGuard(parentPath) || parentContainsValitOrGuard(parentPath);
    case "ObjectExpression":
      return containsValitOrGuard(parentPath) || parentContainsValitOrGuard(parentPath);
    case "ObjectProperty":
      return parentContainsValitOrGuard(parentPath);
    case "MemberExpression":
      return containsValitOrGuard(parentPath) || parentContainsValitOrGuard(parentPath);
    default:
      return false;
  }
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
