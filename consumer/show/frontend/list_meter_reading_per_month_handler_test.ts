import { BIGTABLE } from "../../../common/bigtable";
import { ListMeterReadingsPerMonthHandler } from "./list_meter_reading_per_month_handler";
import { LIST_METER_READINGS_PER_MONTH_RESPONSE } from "@phading/product_meter_service_interface/consumer/show/frontend/interface";
import { ExchangeSessionAndCheckCapabilityResponse } from "@phading/user_session_service_interface/backend/interface";
import { eqMessage } from "@selfage/message/test_matcher";
import { NodeServiceClientMock } from "@selfage/node_service_client/client_mock";
import { assertThat } from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";

TEST_RUNNER.run({
  name: "ListMeterReadingsPerMonthHandlerTest",
  cases: [
    {
      name: "Default",
      execute: async () => {
        // Prepare
        await BIGTABLE.insert([
          {
            key: "f3#consumer1#2024-09",
            data: {
              t: {
                w: {
                  value: 100,
                },
              },
            },
          },
          {
            key: "f3#consumer1#2024-10",
            data: {
              t: {
                w: {
                  value: 200,
                },
              },
            },
          },
          {
            key: "f3#consumer1#2024-12",
            data: {
              t: {
                w: {
                  value: 300,
                },
              },
            },
          },
          {
            key: "f3#consumer1#2025-01",
            data: {
              t: {
                w: {
                  value: 400,
                },
              },
            },
          },
          {
            key: "f3#consumer1#2025-02",
            data: {
              t: {
                w: {
                  value: 500,
                },
              },
            },
          },
        ]);
        let clientMock = new NodeServiceClientMock();
        clientMock.response = {
          userSession: {
            accountId: "consumer1",
          },
          canConsumeShows: true,
        } as ExchangeSessionAndCheckCapabilityResponse;
        let handler = new ListMeterReadingsPerMonthHandler(
          BIGTABLE,
          clientMock,
        );

        // Execute
        let resposne = await handler.handle(
          "",
          { startMonth: "2024-10", endMonth: "2025-01" },
          "session1",
        );

        // Verify
        assertThat(
          resposne,
          eqMessage(
            {
              readings: [
                {
                  month: "2024-10",
                  watchTimeSec: 200,
                },
                {
                  month: "2024-12",
                  watchTimeSec: 300,
                },
                {
                  month: "2025-01",
                  watchTimeSec: 400,
                },
              ],
            },
            LIST_METER_READINGS_PER_MONTH_RESPONSE,
          ),
          "response",
        );
      },
      tearDown: async () => {
        await BIGTABLE.deleteRows("f");
      },
    },
  ],
});
