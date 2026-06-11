import { createScope, molecule } from "bunshi/react";
import { atom } from "jotai";

/** 侧边栏布局状态的作用域键。不同页面/项目用不同的键值，各自持有独立的一份布局状态。 */
export const SidebarLayoutScope = createScope<string>("default");

export const SidebarLayoutMolecule = molecule((_, getScope) => {
  getScope(SidebarLayoutScope);

  return {
    heightsAtom: atom<number[]>([]),
    collapsedAtom: atom<boolean[]>([]),
    rememberedAtom: atom<number[]>([]),
    containerHeightAtom: atom<number>(0),
    initializedAtom: atom<boolean>(false),
  };
});
