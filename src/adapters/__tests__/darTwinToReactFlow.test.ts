import { describe, expect, it } from "vitest";

import { parseDarTwin } from "../../parser/parseDarTwin";
import { darTwinToReactFlow } from "../darTwinToReactFlow";

const sample = `#dartwin StrawberryCultivationTrans {
  #twinsystem Strawberry {
    connect Strawberry.Cultivation.MultiSensor        to StrawberryDT.multisensor_input;
    connect StrawberryDT.actuator_output_irrigation   to Strawberry.Cultivation.IrrigationActuator;
    connect StrawberryDT.actuator_output_human        to Strawberry.Cultivation.HumanActuator;
    connect StrawberryDT.actuator_output_ventilation  to Strawberry.Cultivation.VentilationActuator;

    #digitaltwin StrawberryDT {
      port multisensor_input;
      port actuator_output_irrigation;
      port actuator_output_human;
      port actuator_output_ventilation;
    }

    part Cultivation {
      port MultiSensor;
      port IrrigationActuator;
      port HumanActuator;
      port VentilationActuator;
    }
  }

  #goal increase_yield { doc /* yield y higher y than before */ }
  #goal apply_decreased_water { doc /* water consumption w lower w than before */ }

  allocate increase_yield to Strawberry.StrawberryDT;
  allocate apply_decreased_water to Strawberry.StrawberryDT;
}`;

describe("darTwinToReactFlow", () => {
  it("converts a DarTwin model to a React Flow graph", () => {
    const model = parseDarTwin(sample);
    const graph = darTwinToReactFlow(model);

    const nodeById = Object.fromEntries(graph.nodes.map((node) => [node.id, node]));

    expect(nodeById["dw::StrawberryCultivationTrans"]).toMatchObject({
      type: "dartwin",
      label: "StrawberryCultivationTrans",
    });

    expect(nodeById["ts::StrawberryCultivationTrans::Strawberry"]).toMatchObject({
      type: "twinsystem",
      parentId: "dw::StrawberryCultivationTrans",
    });

    expect(nodeById["dt::StrawberryCultivationTrans::Strawberry::StrawberryDT"]).toMatchObject({
      type: "dt",
      parentId: "ts::StrawberryCultivationTrans::Strawberry",
    });

    expect(nodeById["at::StrawberryCultivationTrans::Strawberry::Cultivation"]).toMatchObject({
      type: "at",
      parentId: "ts::StrawberryCultivationTrans::Strawberry",
    });

    expect(nodeById["goal::StrawberryCultivationTrans::increase_yield"]).toMatchObject({
      type: "goal",
      parentId: "dw::StrawberryCultivationTrans",
    });

    expect(graph.nodes).toHaveLength(14);

    const edgeById = Object.fromEntries(graph.edges.map((edge) => [edge.id, edge]));

    expect(edgeById["connect::Strawberry::0"]).toMatchObject({
      source:
        "port::StrawberryCultivationTrans::Strawberry::Cultivation::MultiSensor",
      target:
        "port::StrawberryCultivationTrans::Strawberry::StrawberryDT::multisensor_input",
    });

    expect(edgeById["allocation::Strawberry.StrawberryDT::increase_yield"]).toMatchObject({
      source: "dt::StrawberryCultivationTrans::Strawberry::StrawberryDT",
      target: "goal::StrawberryCultivationTrans::increase_yield",
      label: "allocate",
    });

    expect(graph.edges.filter((edge) => edge.label === "allocate")).toHaveLength(2);
    expect(graph.edges.filter((edge) => edge.label !== "allocate")).toHaveLength(4);
  });
});
