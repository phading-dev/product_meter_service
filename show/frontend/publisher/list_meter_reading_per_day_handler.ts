import { BIGTABLE } from "../../../common/bigtable";
import { toDateISOString } from "../../../common/date_helper";
import { SERVICE_CLIENT } from "../../../common/service_client";
import { Table } from "@google-cloud/bigtable";
import { ListMeterReadingsPerDayHandlerInterface } from "@phading/product_meter_service_interface/show/frontend/publisher/handler";
import {
  ListMeterReadingsPerDayRequestBody,
  ListMeterReadingsPerDayResponse,
} from "@phading/product_meter_service_interface/show/frontend/publisher/interface";
import { MeterReadingPerDay } from "@phading/product_meter_service_interface/show/frontend/publisher/meter_reading";
import { exchangeSessionAndCheckCapability } from "@phading/user_session_service_interface/backend/client";
import { newBadRequestError, newUnauthorizedError } from "@selfage/http_error";
import { NodeServiceClient } from "@selfage/node_service_client";

export class ListMeterReadingsPerDayHandler extends ListMeterReadingsPerDayHandlerInterface {
  public static create(): ListMeterReadingsPerDayHandler {
    return new ListMeterReadingsPerDayHandler(BIGTABLE, SERVICE_CLIENT);
  }

  public constructor(
    private bigtable: Table,
    private serviceClient: NodeServiceClient,
  ) {
    super();
  }

  public async handle(
    loggingPrefix: string,
    body: ListMeterReadingsPerDayRequestBody,
    sessionStr: string,
  ): Promise<ListMeterReadingsPerDayResponse> {
    if (!body.startDate) {
      throw newBadRequestError(`"startDate" is required.`);
    }
    if (!body.endDate) {
      throw newBadRequestError(`"endDate" is required.`);
    }
    let startDate = new Date(body.startDate);
    if (isNaN(startDate.valueOf())) {
      throw newBadRequestError(`"startDate" is not a valid date.`);
    }
    let endDate = new Date(body.endDate);
    if (isNaN(endDate.valueOf())) {
      throw newBadRequestError(`"endDate" is not a valid date.`);
    }
    if (startDate >= endDate) {
      throw newBadRequestError(`"startDate" must be smaller than "endDate".`);
    }
    let { accountId, canPublishShows } =
      await exchangeSessionAndCheckCapability(this.serviceClient, {
        signedSession: sessionStr,
        checkCanPublishShows: true,
      });
    if (!canPublishShows) {
      throw newUnauthorizedError(
        `Account ${accountId} not allowed to list meter reading per day.`,
      );
    }

    let [rows] = await this.bigtable.getRows({
      start: `f3#${accountId}#${toDateISOString(startDate)}`,
      end: `f3#${accountId}#${toDateISOString(endDate)}`,
      filter: [
        {
          family: /^t$/,
        },
        {
          column: {
            cellLimit: 1,
          },
        },
      ],
    });
    let readings: Array<MeterReadingPerDay> = rows.map(
      (row): MeterReadingPerDay => {
        return {
          date: row.id.split("#")[2],
          watchTimeSecGraded: row.data["t"]["w"][0].value,
          transmittedKb: row.data["t"]["kb"][0].value,
        };
      },
    );
    return {
      readings,
    };
  }
}
