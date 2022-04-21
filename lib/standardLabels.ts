export function StandardLabels(name: string): { [key: string]: string } {
  return {
    "app.kubernetes.io/name": name,
    "app.kubernetes.io/managed-by": "cdk8s",
  };
}

export function aggregateToClusterAdmin(labels: { [key: string]: string }): {
  [key: string]: string;
} {
  const aggregateLabelKey = "rbac.serenacodes.com/aggregate-to-cluster-admin";
  return Object.assign({}, { [aggregateLabelKey]: "true" }, labels);
}
