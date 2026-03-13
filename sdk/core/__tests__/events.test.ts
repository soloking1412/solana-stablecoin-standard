import { expect } from "chai";
import { EventManager } from "../src/events";

describe("EventManager", () => {
  let manager: EventManager;

  beforeEach(() => {
    manager = new EventManager();
  });

  it("registers and triggers listener", () => {
    let received = false;
    manager.on("test", () => { received = true; });
    manager.emit("test", {});
    expect(received).to.be.true;
  });

  it("passes event data to listener", () => {
    let data: unknown = null;
    manager.on("mint", (d) => { data = d; });
    manager.emit("mint", { amount: 100 });
    expect(data).to.deep.equal({ amount: 100 });
  });

  it("supports multiple listeners for same event", () => {
    let count = 0;
    manager.on("burn", () => { count++; });
    manager.on("burn", () => { count++; });
    manager.emit("burn", {});
    expect(count).to.equal(2);
  });

  it("returns unsubscribe function", () => {
    let count = 0;
    const unsub = manager.on("test", () => { count++; });
    manager.emit("test", {});
    expect(count).to.equal(1);

    unsub();
    manager.emit("test", {});
    expect(count).to.equal(1);
  });

  it("does not trigger listeners for different events", () => {
    let triggered = false;
    manager.on("mint", () => { triggered = true; });
    manager.emit("burn", {});
    expect(triggered).to.be.false;
  });

  it("removeAll clears all listeners", () => {
    let count = 0;
    manager.on("a", () => { count++; });
    manager.on("b", () => { count++; });
    manager.removeAll();
    manager.emit("a", {});
    manager.emit("b", {});
    expect(count).to.equal(0);
  });

  it("swallows listener errors", () => {
    manager.on("test", () => { throw new Error("boom"); });
    expect(() => manager.emit("test", {})).to.not.throw();
  });

  it("handles emit with no listeners", () => {
    expect(() => manager.emit("nothing", {})).to.not.throw();
  });

  it("supports typed events", () => {
    interface MintEvent { amount: number; recipient: string; }
    let data: MintEvent | null = null;
    manager.on<MintEvent>("mint", (e) => { data = e; });
    manager.emit("mint", { amount: 100, recipient: "abc" });
    expect(data!.amount).to.equal(100);
    expect(data!.recipient).to.equal("abc");
  });

  it("preserves event order", () => {
    const order: number[] = [];
    manager.on("seq", () => { order.push(1); });
    manager.on("seq", () => { order.push(2); });
    manager.on("seq", () => { order.push(3); });
    manager.emit("seq", {});
    expect(order).to.deep.equal([1, 2, 3]);
  });
});
