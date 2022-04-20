import { Construct } from "constructs";
import { KubeClusterRole, KubeClusterRoleBinding } from "../imports/k8s";
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
    const aggregateLabelKey = "rbac.serenacodes.com/aggregate-to-cluster-admin";
    const aggregatedRoleLabels = Object.assign(
      {},
      { [aggregateLabelKey]: "true" },
      rbacLabel
    );
    // TODO make adminRoleName configurable
    const adminRoleName = setNamePrefix(prefix, "cluster-admin");
    const readVerbs = ["get", "list", "watch"];
    // TODO make rules configurable
    const adminRules = [
      {
        apiGroups: [""],
        verbs: ["*"],
        resources: [
          "bindings",
          "configmaps",
          "endpoints",
          "namespaces",
          "nodes",
          "persistentvolumeclaims",
          "persistentvolumes",
          "pods",
          "replicationcontrollers",
          "resourcequotas",
          "secrets",
          "serviceaccounts",
          "services",
        ],
      },
      {
        apiGroups: [""],
        verbs: readVerbs,
        resources: ["events"],
      },
      {
        apiGroups: ["apiextensions.k8s.io"],
        verbs: ["*"],
        resources: ["customresourcedefinitions"],
      },
      {
        apiGroups: ["apiregistration.k8s.io"],
        verbs: ["*"],
        resources: ["apiservices"],
      },
      {
        apiGroups: ["authentication.k8s.io"],
        verbs: ["*"],
        resources: [
          "localsubjectaccessreviews",
          "selfsubjectaccessreviews",
          "selfsubjectrulesreviews",
          "subjectaccessreviews",
        ],
      },
      {
        apiGroups: ["batch"],
        verbs: ["*"],
        resources: ["cronjobs", "jobs"],
      },
      {
        apiGroups: ["apps"],
        verbs: ["*"],
        resources: [
          "controllerrevisions",
          "daemonsets",
          "replicasets",
          "statefulsets",
        ],
      },
      {
        apiGroups: ["autoscaling"],
        verbs: ["*"],
        resources: ["horizontalpodautoscalers"],
      },
      {
        apiGroups: ["events.k8s.io"],
        verbs: readVerbs,
        resources: ["events"],
      },
      {
        apiGroups: ["networking.k8s.io"],
        verbs: ["*"],
        resources: ["ingressclasses", "ingresses", "networkpolicies"],
      },
      {
        apiGroups: ["policy"],
        verbs: ["*"],
        resources: ["poddisruptionbudgets"],
      },
      {
        apiGroups: ["rbac.authorization.k8s.io"],
        verbs: ["*"],
        resources: [
          "clusterrolebindings",
          "clusterroles",
          "rolebindings",
          "roles",
        ],
      },
    ];

    // All roles will be aggregated into this one
    new KubeClusterRole(this, "aggregated-cluster-role", {
      metadata: {
        name: adminRoleName,
        labels: rbacLabel,
      },
      aggregationRule: {
        clusterRoleSelectors: [
          {
            matchLabels: {
              [aggregateLabelKey]: "true",
            },
          },
        ],
      },
    });
    // This role targets the existing out of the box k8s resources
    new KubeClusterRole(this, "admin-core-resources", {
      metadata: {
        name: setNamePrefix(prefix, "admin-core-resources"),
        labels: aggregatedRoleLabels,
      },
      rules: adminRules,
    });

    // Rolebinding for user
    new KubeClusterRoleBinding(this, "user-role-binding", {
      metadata: {
        name: setNamePrefix(prefix, userName).concat("-rolebinding"),
        labels: rbacLabel,
      },
      roleRef: {
        apiGroup: "rbac.authorization.k8s.io",
        kind: "ClusterRole",
        name: adminRoleName,
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
