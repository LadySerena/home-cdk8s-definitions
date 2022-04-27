import { Construct } from "constructs";
import { KubeClusterRoleBinding } from "../imports/k8s";
import { StandardLabels } from "./standardLabels";

function setNamePrefix(prefix: string, name: string): string {
  return prefix.concat("-", name);
}

export interface SystemRbacProps {
  readonly user: string;
  readonly resourcePrefix: string;
}

export class SystemRbac extends Construct {
  constructor(scope: Construct, id: string, props: SystemRbacProps) {
    super(scope, id);
    const userName = props.user || "default-user";
    const prefix = props.resourcePrefix || "ckd8s";
    // TODO make labels configurable
    const rbacLabel = StandardLabels("system-rbac");
    // TODO make aggregateLabelKey configurable

    // Rolebinding for user
    new KubeClusterRoleBinding(this, "user-role-binding", {
      metadata: {
        name: setNamePrefix(prefix, userName).concat("-rolebinding"),
        labels: rbacLabel,
      },
      roleRef: {
        apiGroup: "rbac.authorization.k8s.io",
        kind: "ClusterRole",
        name: "cluster-admin",
      },
      subjects: [
        {
          kind: "User",
          name: userName,
          apiGroup: "rbac.authorization.k8s.io",
        },
      ],
    });
  }
}
