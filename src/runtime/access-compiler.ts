import {
  ProductAccessDeclarationSchema,
  type ProductAccessDeclaration,
} from '../contracts/access';

export interface CompiledProductAccessDeclaration {
  declaration: ProductAccessDeclaration;
  permissionsByCode: ReadonlyMap<string, ProductAccessDeclaration['permissions'][number]>;
  permissionCodesByBundle: ReadonlyMap<string, readonly string[]>;
  permissionCodesBySystemGroup: ReadonlyMap<string, readonly string[]>;
  permissionPolicyBySystemGroup: ReadonlyMap<string, ProductAccessDeclaration['systemGroups'][number]['permissionPolicy']>;
}

const uniqueBy = <T>(values: readonly T[], key: (value: T) => string, label: string): Map<string, T> => {
  const result = new Map<string, T>();
  for (const value of values) {
    const id = key(value);
    if (result.has(id)) throw new Error(`Duplicate ${label} ${id}.`);
    result.set(id, value);
  }
  return result;
};

export const compileProductAccessDeclaration = (
  input: ProductAccessDeclaration,
): CompiledProductAccessDeclaration => {
  const declaration = ProductAccessDeclarationSchema.parse(input);
  const permissionsByCode = uniqueBy(declaration.permissions, (item) => item.code, 'permission');
  const bundlesById = uniqueBy(declaration.permissionBundles, (item) => item.bundleId, 'permission bundle');
  uniqueBy(declaration.systemGroups, (item) => item.groupCode, 'system group');

  const permissionCodesByBundle = new Map<string, readonly string[]>();
  for (const bundle of declaration.permissionBundles) {
    for (const permissionCode of bundle.permissionCodes) {
      if (!permissionsByCode.has(permissionCode)) {
        throw new Error(`Permission bundle ${bundle.bundleId} references unknown permission ${permissionCode}.`);
      }
    }
    permissionCodesByBundle.set(bundle.bundleId, [...new Set(bundle.permissionCodes)]);
  }

  const permissionCodesBySystemGroup = new Map<string, readonly string[]>();
  const permissionPolicyBySystemGroup = new Map<string, ProductAccessDeclaration['systemGroups'][number]['permissionPolicy']>();
  for (const group of declaration.systemGroups) {
    const permissionCodes = new Set<string>();
    permissionPolicyBySystemGroup.set(group.groupCode, group.permissionPolicy);
    if (group.permissionPolicy === 'all_current') {
      for (const permission of declaration.permissions) permissionCodes.add(permission.code);
    }
    if (group.permissionPolicy === 'studio_current') {
      for (const permission of declaration.permissions) {
        if (permission.domain === 'studio' || permission.code.startsWith('studio:')) permissionCodes.add(permission.code);
      }
    }
    for (const bundleId of group.permissionBundleIds) {
      if (!bundlesById.has(bundleId)) {
        throw new Error(`System group ${group.groupCode} references unknown permission bundle ${bundleId}.`);
      }
      for (const permissionCode of permissionCodesByBundle.get(bundleId) ?? []) {
        permissionCodes.add(permissionCode);
      }
    }
    permissionCodesBySystemGroup.set(group.groupCode, [...permissionCodes]);
  }

  return {
    declaration,
    permissionsByCode,
    permissionCodesByBundle,
    permissionCodesBySystemGroup,
    permissionPolicyBySystemGroup,
  };
};
