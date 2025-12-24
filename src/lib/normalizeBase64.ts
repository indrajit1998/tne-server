function normalizeBase64(input: string) {
  if (input.startsWith('data:image')) {
    return input.split(',')[1];
  }
  return input;
}

export default normalizeBase64;
