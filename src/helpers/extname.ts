import { basename } from "./basename";

export function extname(pth: string) {
  return (
    "." +
    basename(pth)
      .split(".")
      .pop()
  );
}
