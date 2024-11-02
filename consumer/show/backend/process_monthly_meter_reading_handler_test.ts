import { BIGTABLE } from "../../../common/bigtable";
import { eqData } from "../../../common/bigtable_data_matcher";
import { ProcessMonthlyMeterReadingHandler } from "./process_monthly_meter_reading_handler";
import {
  GENERATE_BILLING_STATEMENT,
  GENERATE_BILLING_STATEMENT_REQUEST_BODY,
} from "@phading/commerce_service_interface/consumer/show/backend/interface";
import { ProductType } from "@phading/price";
import { eqMessage } from "@selfage/message/test_matcher";
import { NodeServiceClientMock } from "@selfage/node_service_client/client_mock";
import {
  assertReject,
  assertThat,
  containStr,
  eq,
} from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";

async function initData() {
  await BIGTABLE.insert([
    {
      key: "t6#2024-10#consumer1",
      data: {
        t: {
          w: {
            value: 0,
          },
        },
        c: {
          p: {
            value: "",
          },
        },
      },
    },
    {
      key: "t2#2024-10#consumer1#01",
      data: {
        t: {
          w: {
            value: 100,
          },
        },
      },
    },
    {
      key: "t2#2024-10#consumer1#18",
      data: {
        t: {
          w: {
            value: 300,
          },
        },
      },
    },
    {
      key: "t2#2024-10#consumer1#20",
      data: {
        t: {
          w: {
            value: 500,
          },
        },
      },
    },
    {
      key: "t2#2024-10#consumer2#20",
      data: {
        t: {
          w: {
            value: 500,
          },
        },
      },
    },
  ]);
}

TEST_RUNNER.run({
  name: "ProcessMonthlyMeterReadingHandlerTest",
  cases: [
    {
      name: "ProcssedInOneShot",
      execute: async () => {
        // Prepare
        await initData();
        let clientMock = new NodeServiceClientMock();
        clientMock.response = {};
        let handler = new ProcessMonthlyMeterReadingHandler(
          BIGTABLE,
          clientMock,
        );

        // Execute
        await handler.handle("", {
          rowKey: "t6#2024-10#consumer1",
        });

        // Verify
        assertThat(
          (await BIGTABLE.row("f3#consumer1#2024-10").get())[0].data,
          eqData({
            t: {
              USDc: {
                value: 3,
              },
            },
          }),
          "final consumer month data",
        );
        assertThat(
          (await BIGTABLE.row("t6#2024-10#consumer1").exists())[0],
          eq(false),
          "original row deleted",
        );
        assertThat(
          (await BIGTABLE.row("t2#2024-10#consumer1#20").exists())[0],
          eq(false),
          "one data row deleted",
        );
        assertThat(
          clientMock.request.descriptor,
          eq(GENERATE_BILLING_STATEMENT),
          "RC descriptor",
        );
        assertThat(
          clientMock.request.body,
          eqMessage(
            {
              accountId: "consumer1",
              month: "2024-10",
              items: [
                {
                  price: {
                    productType: ProductType.SHOW,
                    money: {
                      amount: 10,
                      currency: "USD",
                    },
                    divideBy: 3600,
                  },
                  quantity: 900,
                  subTotal: {
                    amount: 3,
                    currency: "USD",
                  },
                },
              ],
              total: {
                amount: 3,
                currency: "USD",
              },
            },
            GENERATE_BILLING_STATEMENT_REQUEST_BODY,
          ),
          "request",
        );
      },
      tearDown: async () => {
        await Promise.all([BIGTABLE.deleteRows("t"), BIGTABLE.deleteRows("f")]);
      },
    },
    {
      name: "InterruptAfterCheckPoint_ResumeAndMarkDone_ResumeWithNoAction",
      execute: async () => {
        // Prepare
        await initData();
        let clientMock = new NodeServiceClientMock();
        clientMock.response = {};
        let handler = new ProcessMonthlyMeterReadingHandler(
          BIGTABLE,
          clientMock,
          () => {
            throw new Error("fake error");
          },
        );

        // Execute
        let error = await assertReject(
          handler.handle("", {
            rowKey: "t6#2024-10#consumer1",
          }),
        );

        // Verify
        assertThat(error.message, containStr("fake"), "error");
        assertThat(
          (await BIGTABLE.row("t6#2024-10#consumer1").get())[0].data,
          eqData({
            t: {
              w: {
                value: 900,
              },
            },
            c: {
              p: {
                value: "1",
              },
            },
          }),
          "checkpoint data",
        );
        assertThat(clientMock.request, eq(undefined), "no RC");

        // Execute
        await handler.handle("", {
          rowKey: "t6#2024-10#consumer1",
        });

        // Verify
        assertThat(
          (await BIGTABLE.row("f3#consumer1#2024-10").get())[0].data,
          eqData({
            t: {
              USDc: {
                value: 3,
              },
            },
          }),
          "final consumer month data",
        );
        assertThat(
          (await BIGTABLE.row("t6#2024-10#consumer1").exists())[0],
          eq(false),
          "original row deleted",
        );
        assertThat(
          (await BIGTABLE.row("t2#2024-10#consumer1#20").exists())[0],
          eq(false),
          "one data row deleted",
        );
        assertThat(
          clientMock.request.descriptor,
          eq(GENERATE_BILLING_STATEMENT),
          "RC descriptor",
        );
        assertThat(
          clientMock.request.body,
          eqMessage(
            {
              accountId: "consumer1",
              month: "2024-10",
              items: [
                {
                  price: {
                    productType: ProductType.SHOW,
                    money: {
                      amount: 10,
                      currency: "USD",
                    },
                    divideBy: 3600,
                  },
                  quantity: 900,
                  subTotal: {
                    amount: 3,
                    currency: "USD",
                  },
                },
              ],
              total: {
                amount: 3,
                currency: "USD",
              },
            },
            GENERATE_BILLING_STATEMENT_REQUEST_BODY,
          ),
          "request",
        );

        // Execute
        await handler.handle("", {
          rowKey: "t6#2024-10#consumer1",
        });

        // Verify no error and no actions
      },
      tearDown: async () => {
        await Promise.all([BIGTABLE.deleteRows("t"), BIGTABLE.deleteRows("f")]);
      },
    },
  ],
});