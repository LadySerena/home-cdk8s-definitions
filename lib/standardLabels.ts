export function StandardLabels(name: string): { [key: string]: string } {
  return {
    "app.kubernetes.io/name": name,
    "app.kubernetes.io/managed-by": "cdk8s",
  };
}
