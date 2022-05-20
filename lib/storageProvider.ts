import { Construct } from "constructs";
import { StandardLabels } from "./standardLabels";
import {
  IntOrString,
  KubeClusterRole,
  KubeClusterRoleBinding,
  KubeIngress,
  KubeService,
  KubeServiceAccount,
  ServicePort,
} from "../imports/k8s";

export interface StorageProps {
  readonly name?: string;
  readonly labels?: { [key: string]: string };
  readonly namespace?: string;
}

export class StorageProvider extends Construct {
  constructor(scope: Construct, id: string, props: StorageProps) {
    super(scope, id);

    const name = props.name || "longhorn";
    const namespace = props.namespace || "longhorn-system";
    const labels = props.labels || StandardLabels(name);

    this.rbac(name, namespace, labels);

    this.workloads(name, namespace, labels);

    new KubeIngress(this, "ui-ingress", {
      metadata: {
        name,
        namespace,
        labels,
      },
      spec: {
        ingressClassName: "nginx",
        rules: [
          {
            host: "longhorn-ui.internal.serenacodes.com",
            http: {
              paths: [
                {
                  backend: {
                    service: {
                      name: "longhorn-frontend",
                      port: {
                        name: "http",
                      },
                    },
                  },
                  path: "/",
                  pathType: "Prefix",
                },
              ],
            },
          },
        ],
      },
    });
  }

  private rbac(name: string, namespace: string, labels: { [key: string]: string }) {
    const account = new KubeServiceAccount(this, "serviceaccount", {
      metadata: { name, namespace, labels },
    });

    const clusterRole = new KubeClusterRole(this, "longhorn-role", {
      metadata: {
        name: `${namespace}:${name}`,
        labels,
      },
      rules: [
        {
          apiGroups: ["apiextensions.k8s.io"],
          resources: ["customresourcedefinitions"],
          verbs: ["*"],
        },
        {
          apiGroups: [""],
          resources: [
            "pods",
            "events",
            "persistentvolumes",
            "persistentvolumeclaims",
            "persistentvolumeclaims/status",
            "nodes",
            "proxy/nodes",
            "pods/log",
            "secrets",
            "services",
            "endpoints",
            "configmaps",
          ],
          verbs: ["*"],
        },
        {
          apiGroups: [""],
          resources: ["namespaces"],
          verbs: ["get", "list"],
        },
        {
          apiGroups: ["apps"],
          resources: ["daemonsets", "statefulsets", "deployments"],
          verbs: ["*"],
        },
        {
          apiGroups: ["batch"],
          resources: ["jobs", "cronjobs"],
          verbs: ["*"],
        },
        {
          apiGroups: ["policy"],
          resources: ["poddisruptionbudgets"],
          verbs: ["*"],
        },
        {
          apiGroups: ["scheduling.k8s.io"],
          resources: ["priorityclasses"],
          verbs: ["watch", "list"],
        },
        {
          apiGroups: ["storage.k8s.io"],
          resources: ["storageclasses", "volumeattachments", "volumeattachments/status", "csinodes", "csidrivers"],
          verbs: ["*"],
        },
        {
          apiGroups: ["snapshot.storage.k8s.io"],
          resources: [
            "volumesnapshotclasses",
            "volumesnapshots",
            "volumesnapshotcontents",
            "volumesnapshotcontents/status",
          ],
          verbs: ["*"],
        },
        {
          apiGroups: ["longhorn.io"],
          resources: [
            "volumes",
            "volumes/status",
            "engines",
            "engines/status",
            "replicas",
            "replicas/status",
            "settings",
            "engineimages",
            "engineimages/status",
            "nodes",
            "nodes/status",
            "instancemanagers",
            "instancemanagers/status",
            "sharemanagers",
            "sharemanagers/status",
            "backingimages",
            "backingimages/status",
            "backingimagemanagers",
            "backingimagemanagers/status",
            "backingimagedatasources",
            "backingimagedatasources/status",
            "backuptargets",
            "backuptargets/status",
            "backupvolumes",
            "backupvolumes/status",
            "backups",
            "backups/status",
            "recurringjobs",
            "recurringjobs/status",
          ],
          verbs: ["*"],
        },
        {
          apiGroups: ["coordination.k8s.io"],
          resources: ["leases"],
          verbs: ["*"],
        },
        {
          apiGroups: ["metrics.k8s.io"],
          resources: ["pods", "nodes"],
          verbs: ["get", "list"],
        },
      ],
    });

    new KubeClusterRoleBinding(this, "clusterrolebinding", {
      metadata: {
        name: `${namespace}:${name}`,
        labels,
      },
      roleRef: {
        apiGroup: clusterRole.apiGroup,
        kind: clusterRole.kind,
        name: clusterRole.name,
      },
      subjects: [
        {
          kind: account.kind,
          name: account.name,
          namespace: account.metadata.namespace,
        },
      ],
    });
  }

  private workloads(name: string, namespace: string, labels: { [key: string]: string }) {
    const managerLabels = Object.assign({}, labels, {
      "app.kubernetes.io/component": "longhorn-manager",
    });

    const frontendLabels = Object.assign({}, labels, {
      "app.kubernetes.io/component": "longhorn-ui",
    });

    const managerPorts: ServicePort = {
      name: "manager",
      port: 9500,
      targetPort: IntOrString.fromString("manager"),
    };

    const frontendPorts: ServicePort = {
      name: "http",
      port: 80,
      targetPort: IntOrString.fromString("http"),
    };

    new KubeService(this, "managerService", {
      metadata: {
        name: `${name}-backend`,
        namespace,
        labels: managerLabels,
      },
      spec: {
        type: "ClusterIP",
        sessionAffinity: "ClientIP",
        selector: managerLabels,
        ports: [managerPorts],
      },
    });

    new KubeService(this, "frontendService", {
      metadata: {
        name: `${name}-frontend`,
        namespace,
        labels: frontendLabels,
      },
      spec: {
        type: "ClusterIP",
        selector: frontendLabels,
        ports: [frontendPorts],
      },
    });


  }
}
