import { Construct } from "constructs";
import { ClusterIssuer } from "../imports/cert-manager.io";
import { Helm } from "cdk8s";
import { KubeNamespace } from "../imports/k8s";

export interface CiliumProps {
  readonly clusterIssuer: ClusterIssuer;
  readonly bootstrap: boolean;
}

export class Cilium extends Construct {

  certManagerNamespace: KubeNamespace

  constructor(scope: Construct, id: string, props: CiliumProps) {
    super(scope, id);

    const issuer = props.clusterIssuer;
    // if we are bootstraping the cluster disable hubble
    const hubbleEnable = !props.bootstrap;

    this.certManagerNamespace = new KubeNamespace(this, "cert-manager", {
      metadata: {
        name: "cert-manager",
      },
    });

    new Helm(this, "cilium", {
      chart: "cilium/cilium",
      helmFlags: ["--namespace", "kube-system", "--version", "1.12.2"],
      values: {
        kubeProxyReplacement: "strict",
        k8sServiceHost: "k8s-control.serenacodes.casa",
        k8sServicePort: 6443,
        ipam: {
          operator: {
            clusterPoolIPv4PodCIDRList: ["10.0.128.0/19", "10.0.160.0/19", "10.0.192.0/19"],
          },
        },
        hubble: {
          enabled: hubbleEnable,
          tls: {
            auto: {
              method: "certmanager",
              certManagerIssuerRef: {
                group: issuer.apiGroup,
                kind: issuer.kind,
                name: issuer.name,
              },
            },
          },
        },
      },
    });
  }
}
