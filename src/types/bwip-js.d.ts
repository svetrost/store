declare module "bwip-js" {
  import type { Buffer } from "node:buffer";

  export interface BwipJsOptions {
    bcid: string;
    text: string;
    scale?: number;
    height?: number;
    width?: number;
    includetext?: boolean;
    textxalign?: "left" | "center" | "right";
    backgroundcolor?: string;
    [key: string]: unknown;
  }

  const bwipjs: {
    toBuffer(options: BwipJsOptions): Promise<Buffer>;
  };

  export default bwipjs;
}