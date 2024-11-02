import { BIGTABLE } from "../../../common/bigtable";
import { toDateISOString, toToday } from "../../../common/date_helper";
import { BATCH_SIZE_OF_MONTHLY_RPOCESSING_CONSUMERS } from "../../../common/params";
import { Table } from "@google-cloud/bigtable";
import { GetMonthlyBatchHandlerInterface } from "@phading/product_meter_service_interface/consumer/show/backend/handler";
import {
  GetMonthlyBatchRequestBody,
  GetMonthlyBatchResponse,
} from "@phading/product_meter_service_interface/consumer/show/backend/interface";

export class GetMonthlyBatchHandler extends GetMonthlyBatchHandlerInterface {
  public static create(): GetMonthlyBatchHandler {
    return new GetMonthlyBatchHandler(
      BATCH_SIZE_OF_MONTHLY_RPOCESSING_CONSUMERS,
      BIGTABLE,
      () => new Date(),
    );
  }

  public constructor(
    private batchSize: number,
    private bigtable: Table,
    private getNowDate: () => Date,
  ) {
    super();
  }

  public async handle(
    loggingPrefix: string,
    body: GetMonthlyBatchRequestBody,
  ): Promise<GetMonthlyBatchResponse> {
    let endMonth = await this.getEndMonth();
    // Do not process today's data.
    let end = `t6#${endMonth}`;
    // Add "0" to skip the start cursor.
    let start = body.cursor ? body.cursor + "0" : `t6#`;
    let [rows] = await this.bigtable.getRows({
      start,
      end,
      limit: this.batchSize,
      filter: [
        {
          row: {
            cellLimit: 1,
          },
        },
        {
          value: {
            strip: true,
          },
        },
      ],
    });
    let rowKeys = rows.map((row) => row.id);
    return {
      rowKeys,
      cursor:
        rowKeys.length === this.batchSize
          ? rowKeys[rowKeys.length - 1]
          : undefined,
    };
  }

  // Either this month or the month of the first unprocessed date from t1# rows.
  private async getEndMonth(): Promise<string> {
    let todayString = toDateISOString(toToday(this.getNowDate()));
    let end = `t1#${todayString}`;
    let start = `t1#`;
    let [rows] = await this.bigtable.getRows({
      start,
      end,
      limit: 1,
      filter: [
        {
          row: {
            cellLimit: 1,
          },
        },
        {
          value: {
            strip: true,
          },
        },
      ],
    });
    let endDate: string;
    if (rows.length === 0) {
      endDate = todayString;
    } else {
      endDate = rows[0].id.split("#")[1];
    }
    let [year, month] = endDate.split("-");
    return `${year}-${month}`;
  }
}