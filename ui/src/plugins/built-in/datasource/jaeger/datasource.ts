import {
  dateMath,
  DateTime,
  MutableDataFrame,
  DataSourceApi,
  DataSourceInstanceSettings,
  DataQueryRequest,
  DataQueryResponse,
  DataQuery,
  FieldType,
} from 'src/packages/datav-core';
import { getBackendSrv} from 'src/packages/datav-core';
import { Observable, from, of } from 'rxjs';
import { map } from 'rxjs/operators';

import { getTimeSrv } from 'src/core/services/time';
import { DatasourceRequestOptions } from 'src/core/services/backend';
import { serializeParams } from 'src/core/library/utils/fetch';

export type JaegerQuery = {
  query: string;
} & DataQuery;

export class JaegerDatasource extends DataSourceApi<JaegerQuery> {
  constructor(private instanceSettings: DataSourceInstanceSettings) {
    super(instanceSettings);
  }

  async metadataRequest(url: string, params?: Record<string, any>): Promise<any> {
    const res = await this._request(url, params, { silent: true }).toPromise();
    return res.data.data;
  }

  query(options: DataQueryRequest<JaegerQuery>): Observable<DataQueryResponse> {
    // At this moment we expect only one target. In case we somehow change the UI to be able to show multiple
    // traces at one we need to change this.
    const id = options.targets[0]?.query;
    if (id) {
      // TODO: this api is internal, used in jaeger ui. Officially they have gRPC api that should be used.
      return this._request(`/api/traces/${encodeURIComponent(id)}`).pipe(
        map(response => {
          return {
            data: [
              new MutableDataFrame({
                fields: [
                  {
                    name: 'trace',
                    type: FieldType.trace,
                    values: response?.data?.data || [],
                  },
                ],
                meta: {
                  preferredVisualisationType: 'trace',
                },
              }),
            ],
          };
        })
      );
    } else {
      return of({
        data: [
          new MutableDataFrame({
            fields: [
              {
                name: 'trace',
                type: FieldType.trace,
                values: [],
              },
            ],
            meta: {
              preferredVisualisationType: 'trace',
            },
          }),
        ],
      });
    }
  }

  async testDatasource(): Promise<any> {
    // http://localhost:3000/api/datasources/proxy/2/api/services
    // http://localhost:9085/api/proxy/1/api/v1/query?query=1%2B1&time=1602485767.66

    // /api/proxy/2/api/services
    const url = `/api/proxy/${this.instanceSettings.id}/api/services`
    
    
    const req = {
      url,
      method: 'GET',
      headers: {},
    };

    await getBackendSrv().datasourceRequest(req);

    return true;
  }

  getTimeRange(): { start: number; end: number } {
    const range = getTimeSrv().timeRange();
    return {
      start: getTime(range.from, false),
      end: getTime(range.to, true),
    };
  }

  getQueryDisplayText(query: JaegerQuery) {
    return query.query;
  }

  private _request(apiUrl: string, data?: any, options?: DatasourceRequestOptions): Observable<Record<string, any>> {
    // Hack for proxying metadata requests
    const baseUrl = `/api/datasources/proxy/${this.instanceSettings.id}`;
    const params = data ? serializeParams(data) : '';
    const url = `${baseUrl}${apiUrl}${params.length ? `?${params}` : ''}`;
    const req = {
      ...options,
      url,
    };

    return from(getBackendSrv().datasourceRequest(req));
  }
}

function getTime(date: string | DateTime, roundUp: boolean) {
  if (typeof date === 'string') {
    date = dateMath.parse(date, roundUp);
  }
  return date.valueOf() * 1000;
}