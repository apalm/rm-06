export function basename(pth: string, ext?: string) {
  const out = last(pth.split("/"));
  if (ext) {
    return out.replace(ext, "");
  }
  return out;
}

function last(xs) {
  return xs[xs.length - 1];
}
