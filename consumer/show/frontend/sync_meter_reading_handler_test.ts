import { BIGTABLE } from "../../../common/bigtable";
import { eqData } from "../../../common/bigtable_data_matcher";
import { SyncMeterReadingHandler } from "./sync_meter_reading_handler";
import { ExchangeSessionAndCheckCapabilityResponse } from "@phading/user_session_service_interface/backend/interface";
import { NodeServiceClientMock } from "@selfage/node_service_client/client_mock";
import { assertThat } from "@selfage/test_matcher";
import { TEST_RUNNER } from "@selfage/test_runner";

TEST_RUNNER.run({
  name: "SyncMeterReadingHandlerTest",
  cases: [
    {
      name: "IncrementTwice",
      execute: async () => {
        // Prepare
        let clientMock = new NodeServiceClientMock();
        clientMock.response = {
          userSession: {
            accountId: "consumer1",
          },
          canConsumeShows: true,
        } as ExchangeSessionAndCheckCapabilityResponse;
        // 2024-10-26 23:xx:xx
        let handler = new SyncMeterReadingHandler(
          BIGTABLE,
          clientMock,
          () => new Date(1729983732156),
        );

        // Execute
        await handler.handle(
          "",
          {
            seasonId: "season1",
            episodeId: "ep1",
            watchTimeMs: 125,
          },
          "session1",
        );

        // Verify
        assertThat(
          (await BIGTABLE.row(`t1#2024-10-26#consumer1`).get())[0].data,
          eqData({
            w: {
              "season1#ep1": {
                value: 125,
              },
            },
          }),
          "1st count",
        );

        // Execute
        await handler.handle(
          "",
          {
            seasonId: "season1",
            episodeId: "ep1",
            watchTimeMs: 200,
          },
          "session1",
        );

        // Verify
        assertThat(
          (await BIGTABLE.row(`t1#2024-10-26#consumer1`).get())[0].data,
          eqData({
            w: {
              "season1#ep1": {
                value: 325,
              },
            },
          }),
          "2nd count",
        );
      },
      tearDown: async () => {
        await BIGTABLE.deleteRows("t1#");
      },
    },
    {
      name: "GetDateBasedOnTimezoneOffset",
      execute: async () => {
        // Prepare
        let clientMock = new NodeServiceClientMock();
        clientMock.response = {
          userSession: {
            accountId: "consumer1",
          },
          canConsumeShows: true,
        } as ExchangeSessionAndCheckCapabilityResponse;
        // 2024-11-01 01:xx:xx UTC
        let handler = new SyncMeterReadingHandler(
          BIGTABLE,
          clientMock,
          () => new Date(1730422832156),
        );

        // Execute
        await handler.handle(
          "",
          {
            seasonId: "season1",
            episodeId: "ep1",
            watchTimeMs: 300,
          },
          "session1",
        );

        // Verify
        assertThat(
          (await BIGTABLE.row(`t1#2024-10-31#consumer1`).get())[0].data,
          eqData({
            w: {
              "season1#ep1": {
                value: 300,
              },
            },
          }),
          "count",
        );
      },
      tearDown: async () => {
        await BIGTABLE.deleteRows("t1#");
      },
    },
  ],
});