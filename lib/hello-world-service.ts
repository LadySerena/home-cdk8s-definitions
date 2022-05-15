import { Construct } from "constructs";
import { StandardLabels } from "./standardLabels";
import { IntOrString, KubeDeployment, KubeIngress, KubeNamespace, KubeService, ObjectMeta } from "../imports/k8s";
import { ServiceMonitor, ServiceMonitorSpecEndpointsTargetPort } from "../imports/monitoring.coreos.com";

export interface HelloWorldProps {
  readonly name?: string;
  readonly labels?: { [key: string]: string };
  readonly namespace?: string;
}

export class HelloWorld extends Construct {
  constructor(scope: Construct, id: string, props: HelloWorldProps) {
    super(scope, id);

    const name = props.name || "hello-world-service";
    const namespace = props.namespace || "hello-world-service";
    const labels = props.labels || StandardLabels(name);

    const metadata: ObjectMeta = {
      name: name,
      namespace: namespace,
      labels: labels,
    };

    new KubeNamespace(this, "namespace", {
      metadata: {
        name: namespace,
        labels: Object.assign({}, labels, {
          "monitoring.serenacodes.com/pod-monitor-opt-in": "true",
          "monitoring.serenacodes.com/service-monitor-opt-in": "true",
        }),
      },
    });

    const portNumber = 8080;

    new KubeDeployment(this, "deploy", {
      metadata: metadata,
      spec: {
        selector: {
          matchLabels: labels,
        },
        template: {
          metadata: {
            labels: labels,
          },
          spec: {
            containers: [
              {
                name: name,
                image: "us.gcr.io/telvanni-platform/hello-world-service:0.0.2",
                ports: [
                  {
                    name: "web",
                    containerPort: portNumber,
                    protocol: "TCP",
                  },
                ],
              },
            ],
            imagePullSecrets: [
              {
                name: "regcred",
              },
            ],
          },
        },
      },
    });

    new ServiceMonitor(this, "service-monitor", {
      metadata: Object.assign({}, metadata, {
        labels: {
          "monitoring.serenacodes.com/pod-monitor-opt-in": "true",
          "monitoring.serenacodes.com/service-monitor-opt-in": "true",
        },
      }),
      spec: {
        selector: {
          matchLabels: labels,
        },
        endpoints: [
          {
            targetPort: ServiceMonitorSpecEndpointsTargetPort.fromNumber(portNumber),
            path: "/metrics",
          },
        ],
      },
    });

    const service = new KubeService(this, "service", {
      metadata: metadata,
      spec: {
        selector: labels,
        ports: [
          {
            name: "web",
            port: portNumber,
            targetPort: IntOrString.fromNumber(portNumber),
          },
        ],
      },
    });

    const hostname = "hello-world.internal.serenacodes.com";

    new KubeIngress(this, "ingress", {
      metadata: Object.assign({}, metadata, {
        annotations: {
          "cert-manager.io/cluster-issuer": "serena-ca",
          "cert-manager.io/common-name": "hello-world.internal.serenacodes.com",
        },
      }),
      spec: {
        ingressClassName: "nginx",
        tls: [
          {
            hosts: [hostname],
            secretName: "hello-world-ingress",
          },
        ],
        rules: [
          {
            host: hostname,
            http: {
              paths: [
                {
                  backend: {
                    service: {
                      name: service.name,
                      port: {
                        number: portNumber,
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
}
