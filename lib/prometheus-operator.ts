import { Construct } from "constructs";
import { aggregateToClusterAdmin, StandardLabels } from "./standardLabels";
import {
  IntOrString,
  KubeClusterRole,
  KubeClusterRoleBinding,
  KubeDeployment,
  KubeNamespace,
  KubeService,
  KubeServiceAccount,
  Quantity,
} from "../imports/k8s";
import { rbacGroup } from "./Constants";

export interface PrometheusOperatorProps {
  readonly name?: string;
  readonly labels?: { [key: string]: string };
  readonly namespace?: string;
}

export class PrometheusOperator extends Construct {
  constructor(scope: Construct, id: string, props: PrometheusOperatorProps) {
    super(scope, id);

    const name = props.name || "prometheus-operator";
    const namespace = props.namespace || "prometheus-system";
    const prometheusLabels = StandardLabels(name);

    const labels = props.labels || prometheusLabels;
    const prometheusApiGroup = "monitoring.coreos.com";

    new KubeNamespace(this, "prometheus-operator-namespace", {
      metadata: {
        name: namespace,
        labels: labels,
      },
    });

    const operatorClusterRole = new KubeClusterRole(
      this,
      "prometheus-operator-clusterrole",
      {
        metadata: {
          name: name,
          labels: labels,
        },
        rules: [
          {
            apiGroups: [prometheusApiGroup],
            resources: [
              "alertmanagers",
              "alertmanagers/finalizers",
              "alertmanagerconfigs",
              "prometheuses",
              "prometheuses/finalizers",
              "thanosrulers",
              "thanosrulers/finalizers",
              "servicemonitors",
              "podmonitors",
              "probes",
              "prometheusrules",
            ],
            verbs: ["*"],
          },
          {
            apiGroups: ["apps"],
            resources: ["statefulsets"],
            verbs: ["*"],
          },
          {
            apiGroups: [""],
            resources: ["configmaps", "secrets"],
            verbs: ["*"],
          },
          {
            apiGroups: [""],
            resources: ["pods"],
            verbs: ["list", "delete"],
          },
          {
            apiGroups: [""],
            resources: ["services", "services/finalizers", "endpoints"],
            verbs: ["get", "create", "update", "delete"],
          },
          {
            apiGroups: [""],
            resources: ["nodes"],
            verbs: ["list", "watch"],
          },
          {
            apiGroups: [""],
            resources: ["namespaces"],
            verbs: ["get", "list", "watch"],
          },
          {
            apiGroups: ["networking.k8s.io"],
            resources: ["ingresses"],
            verbs: ["get", "list", "watch"],
          },
        ],
      }
    );

    const operatorServiceAccount = new KubeServiceAccount(
      this,
      "prometheus-operator-serviceaccount",
      {
        metadata: {
          name: name,
          namespace: namespace,
          labels: labels,
        },
        automountServiceAccountToken: false,
      }
    );

    new KubeClusterRoleBinding(this, "prometheus-operator", {
      metadata: {
        name: name,
        labels: labels,
      },
      roleRef: {
        apiGroup: rbacGroup,
        kind: operatorClusterRole.kind,
        name: operatorClusterRole.name,
      },
      subjects: [
        {
          kind: operatorServiceAccount.kind,
          name: operatorServiceAccount.name,
          namespace: operatorServiceAccount.metadata.namespace,
        },
      ],
    });

    const controllerContainerName = "prometheus-operator";
    const containerPortName = "http";

    new KubeDeployment(this, "prometheus-operator-deployment", {
      metadata: {
        labels: labels,
        name: name,
        namespace: namespace,
      },
      spec: {
        replicas: 1,
        selector: {
          matchLabels: labels,
        },
        template: {
          metadata: {
            annotations: {
              "kubectl.kubernetes.io/default-container":
                controllerContainerName,
            },
            labels: labels,
          },
          spec: {
            automountServiceAccountToken: true,
            nodeSelector: {
              "kubernetes.io/os": "linux",
            },
            securityContext: {
              runAsNonRoot: true,
              runAsUser: 65534,
            },
            serviceAccountName: operatorServiceAccount.name,
            containers: [
              {
                name: controllerContainerName,
                args: [
                  "--kubelet-service=kube-system/kubelet",
                  "--prometheus-config-reloader=quay.io/prometheus-operator/prometheus-config-reloader:v0.55.1",
                ],
                image:
                  "quay.io/prometheus-operator/prometheus-operator:v0.55.1",
                ports: [
                  {
                    containerPort: 8080,
                    name: containerPortName,
                  },
                ],
                resources: {
                  requests: {
                    cpu: Quantity.fromString("100m"),
                    memory: Quantity.fromString("100Mi"),
                  },
                  limits: {
                    cpu: Quantity.fromString("200m"),
                    memory: Quantity.fromString("100Mi"),
                  },
                },
                securityContext: {
                  allowPrivilegeEscalation: false,
                  capabilities: {
                    drop: ["ALL"],
                  },
                  readOnlyRootFilesystem: true,
                },
              },
            ],
          },
        },
      },
    });

    new KubeService(this, "prometheus-operator-service", {
      metadata: {
        name: name,
        namespace: namespace,
        labels: labels,
      },
      spec: {
        clusterIp: "None",
        ports: [
          {
            name: containerPortName,
            port: 8080,
            targetPort: IntOrString.fromString(containerPortName),
          },
        ],
        selector: labels,
      },
    });

    new KubeClusterRole(this, "prometheus-aggregated", {
      metadata: {
        name: "prometheus-crd-admin-roles",
        labels: aggregateToClusterAdmin(labels),
      },
      rules: [
        {
          apiGroups: ["monitoring.coreos.com"],
          resources: [
            "alertmanagerconfigs",
            "alertmanagers",
            "podmonitors",
            "probes",
            "prometheuses",
            "prometheusrules",
            "servicemonitors",
            "thanosrulers",
          ],
          verbs: ["*"],
        },
      ],
    });
  }
}
