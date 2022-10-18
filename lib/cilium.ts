import { Construct } from "constructs";
import { ClusterIssuer } from "../imports/cert-manager.io";
import { Helm } from "cdk8s";

export interface CiliumProps {
  readonly clusterIssuer: ClusterIssuer;
}

export class Cilium extends Construct {
  constructor(scope: Construct, id: string) {
    super(scope, id);

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
      },
    });
  }
}
