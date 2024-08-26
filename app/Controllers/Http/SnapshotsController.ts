 import type { HttpContextContract } from '@ioc:Adonis/Core/HttpContext'
 import Snapshot from 'App/Models/Snapshot'

export default class SnapshotsController {


    public async show(ctx: HttpContextContract) {

        const { params } = ctx;


        const snapshotId = params.id;

        const snapshot = await Snapshot.findOrFail(snapshotId);

        // return snapshot as JSON download
        return snapshot;
    }

}
