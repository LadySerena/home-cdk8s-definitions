import { Construct } from "constructs";
import { StandardLabels } from "./standardLabels";
import {
  IntOrString,
  KubeClusterRole,
  KubeClusterRoleBinding,
  KubeConfigMap,
  KubeDeployment,
  KubeMutatingWebhookConfiguration,
  KubeNamespace,
  KubeRole,
  KubeRoleBinding,
  KubeService,
  KubeServiceAccount,
  KubeValidatingWebhookConfiguration,
} from "../imports/k8s";
import { rbacGroup, readVerbs } from "./Constants";

export interface CertManagerProps {
  readonly name?: string;
  readonly labels?: { [key: string]: string };
  readonly namespace?: string;
  readonly resourceNamespace: string;
}

export class CertManager extends Construct {
  constructor(scope: Construct, id: string, props: CertManagerProps) {
    super(scope, id);

    const standardLabels = StandardLabels("cert-server");

    const name = props.name || "cert-manager";
    const labels = props.labels || standardLabels;
    const namespace = props.namespace || "cert-manager";

    labels["app.kubernetes.io/version"] = "v1.8.0";

    new KubeNamespace(this, "namespace", {
      metadata: {
        name: namespace,
        labels: labels,
      },
    });

    const caInjectorAccount = new KubeServiceAccount(this, "caInjectorAccount", {
      metadata: {
        name: `${name}-cainjector`,
        namespace: namespace,
        labels: labels,
      },
    });

    const certManagerAccount = new KubeServiceAccount(this, "certManagerAccount", {
      metadata: {
        name: name,
        namespace: namespace,
        labels: labels,
      },
    });

    const certManagerWebhookAccount = new KubeServiceAccount(this, "certManagerWehbookAccount", {
      metadata: {
        name: `${name}-webhook`,
        namespace: namespace,
        labels: labels,
      },
    });

    new KubeConfigMap(this, "certManagerConfig", {
      metadata: {
        name: `${name}-webhook`,
        namespace: namespace,
        labels: labels,
      },
      data: {},
    });

    const caInjectorClusterRole = new KubeClusterRole(this, "caInjectorClusterRole", {
      metadata: {
        name: `${namespace}:${name}-cainjector`,
        labels: labels,
      },
      rules: [
        {
          apiGroups: ["cert-manager.io"],
          resources: ["certificates"],
          verbs: readVerbs,
        },
        {
          apiGroups: [""],
          resources: ["secrets"],
          verbs: readVerbs,
        },
        {
          apiGroups: [""],
          resources: ["events"],
          verbs: ["get", "create", "update", "patch"],
        },
        {
          apiGroups: ["admissionregistration.k8s.io"],
          resources: ["validatingwebhookconfigurations", "mutatingwebhookconfigurations"],
          verbs: ["get", "list", "watch", "update"],
        },
        {
          apiGroups: ["apiregistration.k8s.io"],
          resources: ["apiservices"],
          verbs: ["get", "list", "watch", "update"],
        },
        {
          apiGroups: ["apiextensions.k8s.io"],
          resources: ["customresourcedefinitions"],
          verbs: ["get", "list", "watch", "update"],
        },
      ],
    });

    const controllerIssuersClusterRole = new KubeClusterRole(this, "controllerIssuersClusterRole", {
      metadata: {
        name: `${namespace}:${name}-controller-issuers`,
        labels: labels,
      },
      rules: [
        {
          apiGroups: ["cert-manager.io"],
          resources: ["issuers", "issuers/status"],
          verbs: ["update", "patch"],
        },
        {
          apiGroups: ["cert-manager.io"],
          resources: ["issuers"],
          verbs: readVerbs,
        },
        {
          apiGroups: [""],
          resources: ["secrets"],
          verbs: ["get", "list", "watch", "create", "update", "delete"],
        },
        {
          apiGroups: [""],
          resources: ["events"],
          verbs: ["create", "patch"],
        },
      ],
    });

    const controllerClusterIssuersClusterRole = new KubeClusterRole(this, "controllerClusterIssuersClusterRole", {
      metadata: {
        name: `${namespace}:${name}-controller-clusterissuers`,
        labels: labels,
      },
      rules: [
        {
          apiGroups: ["cert-manager.io"],
          resources: ["clusterissuers", "clusterissuers/status"],
          verbs: ["update", "patch"],
        },
        {
          apiGroups: ["cert-manager.io"],
          resources: ["clusterissuers"],
          verbs: readVerbs,
        },
        {
          apiGroups: [""],
          resources: ["secrets"],
          verbs: ["get", "list", "watch", "create", "update", "delete"],
        },
        {
          apiGroups: [""],
          resources: ["events"],
          verbs: ["create", "patch"],
        },
      ],
    });

    const controllerCertificatesClusterRole = new KubeClusterRole(this, "controllerCertificatesClusterRole", {
      metadata: {
        name: `${namespace}:${name}-controller-certificates`,
        labels: labels,
      },
      rules: [
        {
          apiGroups: ["cert-manager.io"],
          resources: ["certificates", "certificates/status", "certificaterequests", "certificaterequests/status"],
          verbs: ["update", "patch"],
        },
        {
          apiGroups: ["cert-manager.io"],
          resources: ["certificates", "certificaterequests", "clusterissuers", "issuers"],
          verbs: readVerbs,
        },
        {
          apiGroups: ["cert-manager.io"],
          resources: ["certificates/finalizers", "certificaterequests/finalizers"],
          verbs: ["update"],
        },
        {
          apiGroups: ["acme.cert-manager.io"],
          resources: ["orders"],
          verbs: ["create", "delete", "get", "list", "watch"],
        },
        {
          apiGroups: [""],
          resources: ["secrets"],
          verbs: ["get", "list", "watch", "create", "update", "delete", "patch"],
        },
        {
          apiGroups: [""],
          resources: ["events"],
          verbs: ["create", "patch"],
        },
      ],
    });

    const controllerOrdersClusterRole = new KubeClusterRole(this, "controllerOrdersClusterRole", {
      metadata: {
        name: `${namespace}:${name}-controller-orders`,
        labels: labels,
      },
      rules: [
        {
          apiGroups: ["acme.cert-manager.io"],
          resources: ["orders", "orders/status"],
          verbs: ["update", "patch"],
        },
        {
          apiGroups: ["acme.cert-manager.io"],
          resources: ["orders", "challenges"],
          verbs: readVerbs,
        },
        {
          apiGroups: ["cert-manager.io"],
          resources: ["clusterissuers", "issuers"],
          verbs: readVerbs,
        },
        {
          apiGroups: ["acme.cert-manager.io"],
          resources: ["challenges"],
          verbs: ["create", "delete"],
        },
        {
          apiGroups: ["acme.cert-manager.io"],
          resources: ["orders/finalizers"],
          verbs: ["update"],
        },
        {
          apiGroups: [""],
          resources: ["secrets"],
          verbs: readVerbs,
        },
        {
          apiGroups: [""],
          resources: ["events"],
          verbs: ["create", "patch"],
        },
      ],
    });

    const controllerChallengesClusterRole = new KubeClusterRole(this, "controllerChallengesClusterRole", {
      metadata: {
        name: `${namespace}:${name}-controller-challenges`,
        labels: labels,
      },
      rules: [
        {
          apiGroups: ["acme.cert-manager.io"],
          resources: ["challenges", "challenges/status"],
          verbs: ["update", "patch"],
        },
        {
          apiGroups: ["acme.cert-manager.io"],
          resources: ["challenges"],
          verbs: readVerbs,
        },
        {
          apiGroups: ["cert-manager.io"],
          resources: ["issuers", "clusterissuers"],
          verbs: readVerbs,
        },
        {
          apiGroups: [""],
          resources: ["secrets"],
          verbs: readVerbs,
        },
        {
          apiGroups: [""],
          resources: ["events"],
          verbs: ["create", "patch"],
        },
        {
          apiGroups: [""],
          resources: ["pods", "services"],
          verbs: ["get", "list", "watch", "create", "delete"],
        },
        {
          apiGroups: ["networking.k8s.io"],
          resources: ["ingresses"],
          verbs: ["get", "list", "watch", "create", "delete", "update"],
        },
        {
          apiGroups: ["gateway.networking.k8s.io"],
          resources: ["httproutes"],
          verbs: ["get", "list", "watch", "create", "delete", "update"],
        },
        {
          apiGroups: ["route.openshift.io"],
          resources: ["routes/custom-host"],
          verbs: ["create"],
        },
        {
          apiGroups: ["acme.cert-manager.io"],
          resources: ["challenges/finalizers"],
          verbs: ["update"],
        },
        {
          apiGroups: [""],
          resources: ["secrets"],
          verbs: readVerbs,
        },
      ],
    });

    const controllerIngressShimClusterRole = new KubeClusterRole(this, "controllerIngressShimClusterRole", {
      metadata: {
        name: `${namespace}:${name}-controller-ingress-shim`,
        labels: labels,
      },
      rules: [
        {
          apiGroups: ["cert-manager.io"],
          resources: ["certificates", "certificaterequests"],
          verbs: ["create", "update", "delete"],
        },
        {
          apiGroups: ["cert-manager.io"],
          resources: ["certificates", "certificaterequests", "issuers", "clusterissuers"],
          verbs: readVerbs,
        },
        {
          apiGroups: ["networking.k8s.io"],
          resources: ["ingresses"],
          verbs: readVerbs,
        },
        {
          apiGroups: ["networking.k8s.io"],
          resources: ["ingresses/finalizers"],
          verbs: ["update"],
        },
        {
          apiGroups: ["gateway.networking.k8s.io"],
          resources: ["gateways", "httproutes"],
          verbs: readVerbs,
        },
        {
          apiGroups: ["gateway.networking.k8s.io"],
          resources: ["gateways/finalizers", "httproutes/finalizers"],
          verbs: ["update"],
        },
        {
          apiGroups: [""],
          resources: ["events"],
          verbs: ["create", "patch"],
        },
      ],
    });

    new KubeClusterRole(this, "view", {
      metadata: {
        name: `${namespace}:${name}-view`,
        labels: Object.assign({}, labels, {
          "rbac.authorization.k8s.io/aggregate-to-view": "true",
          "rbac.authorization.k8s.io/aggregate-to-edit": "true",
          "rbac.authorization.k8s.io/aggregate-to-admin": "true",
        }),
      },
      rules: [
        {
          apiGroups: ["cert-manager.io"],
          resources: ["certificates", "certificaterequests", "issuers"],
          verbs: readVerbs,
        },
        {
          apiGroups: ["acme.cert-manager.io"],
          resources: ["challenges", "orders"],
          verbs: readVerbs,
        },
      ],
    });

    new KubeClusterRole(this, "edit", {
      metadata: {
        name: `${namespace}:${name}-edit`,
        labels: Object.assign({}, labels, {
          "rbac.authorization.k8s.io/aggregate-to-edit": "true",
          "rbac.authorization.k8s.io/aggregate-to-admin": "true",
        }),
      },
      rules: [
        {
          apiGroups: ["cert-manager.io"],
          resources: ["certificates", "certificaterequests", "issuers"],
          verbs: ["create", "delete", "deletecollection", "patch", "update"],
        },
        {
          apiGroups: ["cert-manager.io"],
          resources: ["certificates/status"],
          verbs: ["update"],
        },
        {
          apiGroups: ["acme.cert-manager.io"],
          resources: ["challenges", "orders"],
          verbs: ["create", "delete", "deletecollection", "patch", "update"],
        },
      ],
    });

    const controllerApproveClusterRole = new KubeClusterRole(this, "controllerApproveClusterRole", {
      metadata: {
        name: `${namespace}:${name}-controller-approve:cert-manager-io`,
        labels: labels,
      },
      rules: [
        {
          apiGroups: ["cert-manager.io"],
          resources: ["signers"],
          verbs: ["approve"],
          resourceNames: ["issuers.cert-manager.io/*", "clusterissuers.cert-manager.io/*"],
        },
      ],
    });

    const controllerCertSignClusterRole = new KubeClusterRole(this, "controllerCertSignClusterRole", {
      metadata: {
        name: `${namespace}:${name}-controller-certificatesigningrequests`,
        labels: labels,
      },
      rules: [
        {
          apiGroups: ["certificates.k8s.io"],
          resources: ["certificatesigningrequests"],
          verbs: ["get", "list", "watch", "update"],
        },
        {
          apiGroups: ["certificates.k8s.io"],
          resources: ["certificatesigningrequests/status"],
          verbs: ["update", "patch"],
        },
        {
          apiGroups: ["certificates.k8s.io"],
          resources: ["signers"],
          resourceNames: ["issuers.cert-manager.io/*", "clusterissuers.cert-manager.io/*"],
          verbs: ["sign"],
        },
        {
          apiGroups: ["authorization.k8s.io"],
          resources: ["subjectaccessreviews"],
          verbs: ["create"],
        },
      ],
    });

    const webhookAccessReviewsClusterRole = new KubeClusterRole(this, "webhookAccessReviewsClusterRole", {
      metadata: {
        name: `${namespace}:${name}-webhook:subjectaccessreviews`,
        labels: labels,
      },
      rules: [
        {
          apiGroups: ["authorization.k8s.io"],
          resources: ["subjectaccessreviews"],
          verbs: ["create"],
        },
      ],
    });

    new KubeClusterRoleBinding(this, "caInjectorBinding", {
      metadata: {
        name: `${namespace}:${name}-cainjector`,
        labels: labels,
      },
      roleRef: {
        apiGroup: rbacGroup,
        kind: caInjectorClusterRole.kind,
        name: caInjectorClusterRole.name,
      },
      subjects: [
        {
          name: caInjectorAccount.name,
          namespace: namespace,
          kind: caInjectorAccount.kind,
        },
      ],
    });

    new KubeClusterRoleBinding(this, "controllerIssuersBinding", {
      metadata: {
        name: `${namespace}:${name}-controller-issuers`,
        labels: labels,
      },
      roleRef: {
        apiGroup: rbacGroup,
        kind: controllerIssuersClusterRole.kind,
        name: controllerIssuersClusterRole.name,
      },
      subjects: [
        {
          name: certManagerAccount.name,
          namespace: namespace,
          kind: certManagerAccount.kind,
        },
      ],
    });

    new KubeClusterRoleBinding(this, "controllerClusterIssuersBinding", {
      metadata: {
        name: `${namespace}:${name}-controller-clusterissuers`,
        labels: labels,
      },
      roleRef: {
        apiGroup: rbacGroup,
        kind: controllerClusterIssuersClusterRole.kind,
        name: controllerClusterIssuersClusterRole.name,
      },
      subjects: [
        {
          name: certManagerAccount.name,
          namespace: namespace,
          kind: certManagerAccount.kind,
        },
      ],
    });

    new KubeClusterRoleBinding(this, "controllerCertificatesBinding", {
      metadata: {
        name: `${namespace}:${name}-controller-certificates`,
        labels: labels,
      },
      roleRef: {
        apiGroup: rbacGroup,
        kind: controllerCertificatesClusterRole.kind,
        name: controllerCertificatesClusterRole.name,
      },
      subjects: [
        {
          name: certManagerAccount.name,
          namespace: namespace,
          kind: certManagerAccount.kind,
        },
      ],
    });

    new KubeClusterRoleBinding(this, "controllerOrdersBinding", {
      metadata: {
        name: `${namespace}:${name}-controller-orders`,
        labels: labels,
      },
      roleRef: {
        apiGroup: rbacGroup,
        kind: controllerOrdersClusterRole.kind,
        name: controllerOrdersClusterRole.name,
      },
      subjects: [
        {
          name: certManagerAccount.name,
          namespace: namespace,
          kind: certManagerAccount.kind,
        },
      ],
    });

    new KubeClusterRoleBinding(this, "controllerChallengesBinding", {
      metadata: {
        name: `${namespace}:${name}-controller-challenges`,
        labels: labels,
      },
      roleRef: {
        apiGroup: rbacGroup,
        kind: controllerChallengesClusterRole.kind,
        name: controllerChallengesClusterRole.name,
      },
      subjects: [
        {
          name: certManagerAccount.name,
          namespace: namespace,
          kind: certManagerAccount.kind,
        },
      ],
    });

    new KubeClusterRoleBinding(this, "ingressShimBinding", {
      metadata: {
        name: `${namespace}:${name}-controller-ingress-shim`,
        labels: labels,
      },
      roleRef: {
        apiGroup: rbacGroup,
        kind: controllerIngressShimClusterRole.kind,
        name: controllerIngressShimClusterRole.name,
      },
      subjects: [
        {
          name: certManagerAccount.name,
          namespace: namespace,
          kind: certManagerAccount.kind,
        },
      ],
    });

    new KubeClusterRoleBinding(this, "approveBinding", {
      metadata: {
        name: `${namespace}:${name}-controller-approve:cert-manager-io`,
        labels: labels,
      },
      roleRef: {
        apiGroup: rbacGroup,
        kind: controllerApproveClusterRole.kind,
        name: controllerApproveClusterRole.name,
      },
      subjects: [
        {
          name: certManagerAccount.name,
          namespace: namespace,
          kind: certManagerAccount.kind,
        },
      ],
    });

    new KubeClusterRoleBinding(this, "certRequestBinding", {
      metadata: {
        name: `${namespace}:${name}-controller-certificatesigningrequests`,
        labels: labels,
      },
      roleRef: {
        apiGroup: rbacGroup,
        kind: controllerCertSignClusterRole.kind,
        name: controllerCertSignClusterRole.name,
      },
      subjects: [
        {
          name: certManagerAccount.name,
          namespace: namespace,
          kind: certManagerAccount.kind,
        },
      ],
    });

    new KubeClusterRoleBinding(this, "accessReviewsBinding", {
      metadata: {
        name: `${namespace}:${name}-webhook:subjectaccessreviews`,
        labels: labels,
      },
      roleRef: {
        apiGroup: rbacGroup,
        kind: webhookAccessReviewsClusterRole.kind,
        name: webhookAccessReviewsClusterRole.name,
      },
      subjects: [
        {
          name: certManagerWebhookAccount.name,
          namespace: namespace,
          kind: certManagerWebhookAccount.kind,
        },
      ],
    });

    const systemNamespace = "kube-system";

    const injectorLeaderRole = new KubeRole(this, "injectorLeaderRole", {
      metadata: {
        name: `${name}-cainjector:leaderelection`,
        namespace: systemNamespace,
        labels: labels,
      },
      rules: [
        {
          apiGroups: ["coordination.k8s.io"],
          resources: ["leases"],
          resourceNames: ["cert-manager-cainjector-leader-election", "cert-manager-cainjector-leader-election-core"],
          verbs: ["get", "update", "patch"],
        },
        {
          apiGroups: ["coordination.k8s.io"],
          resources: ["leases"],
          verbs: ["create"],
        },
      ],
    });

    const managerLeaderRole = new KubeRole(this, "managerLeaderRole", {
      metadata: {
        name: `${name}:leaderelection`,
        namespace: systemNamespace,
        labels: labels,
      },
      rules: [
        {
          apiGroups: ["coordination.k8s.io"],
          resources: ["leases"],
          resourceNames: ["cert-manager-controller"],
          verbs: ["get", "update", "patch"],
        },
        {
          apiGroups: ["coordination.k8s.io"],
          resources: ["leases"],
          verbs: ["create"],
        },
      ],
    });

    const servingRole = new KubeRole(this, "servingRole", {
      metadata: {
        name: `${name}-webhook:dynamic-serving`,
        namespace: namespace,
        labels: labels,
      },
      rules: [
        {
          apiGroups: [""],
          resources: ["secrets"],
          resourceNames: ["cert-manager-webhook-ca"],
          verbs: ["get", "list", "watch", "update"],
        },
        {
          apiGroups: [""],
          resources: ["secrets"],
          verbs: ["create"],
        },
      ],
    });

    new KubeRoleBinding(this, "injectorLeaderBinding", {
      metadata: {
        name: `${name}-cainjector:leaderelection`,
        namespace: systemNamespace,
        labels: labels,
      },
      roleRef: {
        apiGroup: rbacGroup,
        kind: injectorLeaderRole.kind,
        name: injectorLeaderRole.name,
      },
      subjects: [
        {
          kind: caInjectorAccount.kind,
          name: caInjectorAccount.name,
          namespace: namespace,
        },
      ],
    });

    new KubeRoleBinding(this, "controllerLeaderBinding", {
      metadata: {
        name: `${name}:leaderelection`,
        namespace: systemNamespace,
        labels: labels,
      },
      roleRef: {
        apiGroup: rbacGroup,
        kind: managerLeaderRole.kind,
        name: managerLeaderRole.name,
      },
      subjects: [
        {
          kind: certManagerAccount.kind,
          name: certManagerAccount.name,
          namespace: namespace,
        },
      ],
    });

    new KubeRoleBinding(this, "servingBinding", {
      metadata: {
        name: `${name}-webhook:dynamic-serving`,
        namespace: namespace,
        labels: labels,
      },
      roleRef: {
        apiGroup: rbacGroup,
        kind: servingRole.kind,
        name: servingRole.name,
      },
      subjects: [
        {
          kind: certManagerWebhookAccount.kind,
          name: certManagerWebhookAccount.name,
          namespace: namespace,
        },
      ],
    });

    new KubeService(this, "manager-service-monitor", {
      metadata: {
        name: name,
        namespace: namespace,
        labels: labels,
      },
      spec: {
        type: "ClusterIP",
        ports: [
          {
            protocol: "TCP",
            port: 9402,
            name: "tcp-prometheus-servicemonitor",
            targetPort: IntOrString.fromNumber(9402),
          },
        ],
        selector: {
          "app.kubernetes.io/name": "cert-manager",
          "app.kubernetes.io/instance": "cert-manager",
          "app.kubernetes.io/component": "controller",
        },
      },
    });

    new KubeService(this, "webhookService", {
      metadata: {
        name: `${name}-webhook`,
        namespace: namespace,
        labels: labels,
      },
      spec: {
        type: "ClusterIP",
        ports: [
          {
            name: "https",
            port: 443,
            protocol: "TCP",
            targetPort: IntOrString.fromString("https"),
          },
        ],
        selector: {
          "app.kubernetes.io/name": "webhook",
          "app.kubernetes.io/instance": "cert-manager",
          "app.kubernetes.io/component": "webhook",
        },
      },
    });

    const injectorLabels = Object.assign({}, labels, {
      app: "cainjector",
      "app.kubernetes.io/name": "cainjector",
      "app.kubernetes.io/instance": "cert-manager",
      "app.kubernetes.io/component": "cainjector",
    });

    new KubeDeployment(this, "injectorDeployment", {
      metadata: {
        name: `${name}-cainjector`,
        namespace: namespace,
        labels: injectorLabels,
      },
      spec: {
        replicas: 1,
        selector: {
          matchLabels: {
            "app.kubernetes.io/name": "cainjector",
            "app.kubernetes.io/instance": "cert-manager",
            "app.kubernetes.io/component": "cainjector",
          },
        },
        template: {
          metadata: {
            labels: injectorLabels,
          },
          spec: {
            serviceAccountName: "cert-manager-cainjector",
            securityContext: {
              runAsNonRoot: true,
            },
            containers: [
              {
                name: "cert-manager",
                image: "quay.io/jetstack/cert-manager-cainjector:v1.8.0",
                imagePullPolicy: "IfNotPresent",
                args: ["--v=2", "--leader-election-namespace=kube-system"],
                env: [
                  {
                    name: "POD_NAMESPACE",
                    valueFrom: {
                      fieldRef: {
                        fieldPath: "metadata.namespace",
                      },
                    },
                  },
                ],
                securityContext: {
                  allowPrivilegeEscalation: false,
                },
              },
            ],
            nodeSelector: {
              "kubernetes.io/os": "linux",
            },
          },
        },
      },
    });

    const managerLabels = Object.assign({}, labels, {
      app: "cert-manager",
      "app.kubernetes.io/name": "cert-manager",
      "app.kubernetes.io/instance": "cert-manager",
      "app.kubernetes.io/component": "controller",
    });

    new KubeDeployment(this, "controllerDeployment", {
      metadata: {
        name: name,
        namespace: namespace,
        labels: managerLabels,
      },
      spec: {
        replicas: 1,
        selector: {
          matchLabels: {
            "app.kubernetes.io/name": "cert-manager",
            "app.kubernetes.io/instance": "cert-manager",
            "app.kubernetes.io/component": "controller",
          },
        },
        template: {
          metadata: {
            labels: managerLabels,
            annotations: {
              "prometheus.io/path": "/metrics",
              "prometheus.io/scrape": "true",
              "prometheus.io/port": "9402",
            },
          },
          spec: {
            serviceAccountName: "cert-manager",
            securityContext: {
              runAsNonRoot: true,
            },
            containers: [
              {
                name: "cert-manager",
                image: "quay.io/jetstack/cert-manager-controller:v1.8.0",
                imagePullPolicy: "IfNotPresent",
                args: [
                  "--v=2",
                  "--cluster-resource-namespace=$(POD_NAMESPACE)",
                  "--leader-election-namespace=kube-system",
                ],
                ports: [
                  {
                    containerPort: 9402,
                    name: "http-metrics",
                    protocol: "TCP",
                  },
                ],
                securityContext: {
                  allowPrivilegeEscalation: false,
                },
                env: [
                  {
                    name: "POD_NAMESPACE",
                    value: "certificate-authority",
                  },
                ],
              },
            ],
            nodeSelector: {
              "kubernetes.io/os": "linux",
            },
          },
        },
      },
    });

    const webhookLabels = Object.assign({}, labels, {
      app: "webhook",
      "app.kubernetes.io/name": "webhook",
      "app.kubernetes.io/instance": "cert-manager",
      "app.kubernetes.io/component": "webhook",
    });

    new KubeDeployment(this, "webhookDeployment", {
      metadata: {
        name: `${name}-webhook`,
        namespace: namespace,
        labels: webhookLabels,
      },
      spec: {
        replicas: 1,
        selector: {
          matchLabels: {
            "app.kubernetes.io/name": "webhook",
            "app.kubernetes.io/instance": "cert-manager",
            "app.kubernetes.io/component": "webhook",
          },
        },
        template: {
          metadata: {
            labels: {
              app: "webhook",
              "app.kubernetes.io/name": "webhook",
              "app.kubernetes.io/instance": "cert-manager",
              "app.kubernetes.io/component": "webhook",
              "app.kubernetes.io/version": "v1.8.0",
            },
          },
          spec: {
            serviceAccountName: "cert-manager-webhook",
            securityContext: {
              runAsNonRoot: true,
            },
            containers: [
              {
                name: "cert-manager",
                image: "quay.io/jetstack/cert-manager-webhook:v1.8.0",
                imagePullPolicy: "IfNotPresent",
                args: [
                  "--v=2",
                  "--secure-port=10250",
                  "--dynamic-serving-ca-secret-namespace=$(POD_NAMESPACE)",
                  "--dynamic-serving-ca-secret-name=cert-manager-webhook-ca",
                  "--dynamic-serving-dns-names=cert-manager-webhook,cert-manager-webhook.cert-manager,cert-manager-webhook.cert-manager.svc",
                ],
                ports: [
                  {
                    name: "https",
                    protocol: "TCP",
                    containerPort: 10250,
                  },
                ],
                livenessProbe: {
                  httpGet: {
                    path: "/livez",
                    port: IntOrString.fromNumber(6080),
                    scheme: "HTTP",
                  },
                  initialDelaySeconds: 60,
                  periodSeconds: 10,
                  timeoutSeconds: 1,
                  successThreshold: 1,
                  failureThreshold: 3,
                },
                readinessProbe: {
                  httpGet: {
                    path: "/healthz",
                    port: IntOrString.fromNumber(6080),
                    scheme: "HTTP",
                  },
                  initialDelaySeconds: 5,
                  periodSeconds: 5,
                  timeoutSeconds: 1,
                  successThreshold: 1,
                  failureThreshold: 3,
                },
                securityContext: {
                  allowPrivilegeEscalation: false,
                },
                env: [
                  {
                    name: "POD_NAMESPACE",
                    valueFrom: {
                      fieldRef: {
                        fieldPath: "metadata.namespace",
                      },
                    },
                  },
                ],
              },
            ],
            nodeSelector: {
              "kubernetes.io/os": "linux",
            },
          },
        },
      },
    });

    new KubeMutatingWebhookConfiguration(this, "webhookMutatingConfig", {
      metadata: {
        name: `${name}-webhook`,
        labels: webhookLabels,
        annotations: {
          "cert-manager.io/inject-ca-from-secret": "cert-manager/cert-manager-webhook-ca",
        },
      },
      webhooks: [
        {
          name: "webhook.cert-manager.io",
          rules: [
            {
              apiGroups: ["cert-manager.io", "acme.cert-manager.io"],
              apiVersions: ["v1"],
              operations: ["CREATE", "UPDATE"],
              resources: ["*/*"],
            },
          ],
          admissionReviewVersions: ["v1"],
          matchPolicy: "Equivalent",
          timeoutSeconds: 10,
          failurePolicy: "Fail",
          sideEffects: "None",
          clientConfig: {
            service: {
              name: "cert-manager-webhook",
              namespace: "cert-manager",
              path: "/mutate",
            },
          },
        },
      ],
    });

    new KubeValidatingWebhookConfiguration(this, "webhookValidatingConfig", {
      metadata: {
        name: `${name}-webhook`,
        labels: webhookLabels,
        annotations: {
          "cert-manager.io/inject-ca-from-secret": "cert-manager/cert-manager-webhook-ca",
        },
      },
      webhooks: [
        {
          name: "webhook.cert-manager.io",
          namespaceSelector: {
            matchExpressions: [
              {
                key: "cert-manager.io/disable-validation",
                operator: "NotIn",
                values: ["true"],
              },
              {
                key: "name",
                operator: "NotIn",
                values: ["cert-manager"],
              },
            ],
          },
          rules: [
            {
              apiGroups: ["cert-manager.io", "acme.cert-manager.io"],
              apiVersions: ["v1"],
              operations: ["CREATE", "UPDATE"],
              resources: ["*/*"],
            },
          ],
          admissionReviewVersions: ["v1"],
          matchPolicy: "Equivalent",
          timeoutSeconds: 10,
          failurePolicy: "Fail",
          sideEffects: "None",
          clientConfig: {
            service: {
              name: "cert-manager-webhook",
              namespace: "cert-manager",
              path: "/validate",
            },
          },
        },
      ],
    });
  }
}
