import { Post } from './entity/Post';
import {
  closeTestingConnections,
  reloadTestingDatabases,
  setupSingleTestingConnection,
} from '../util/test-utils';
import { Connection, createConnection } from 'typeorm';
import { RLSConnection } from '../../lib/common';
import { TenancyModelOptions } from '../../lib/interfaces';
import { expect } from 'chai';
import { PostgresDriver } from 'typeorm/driver/postgres/PostgresDriver';

describe('RLSConnection', () => {
  let connection: RLSConnection;
  let originalConnection: Connection;

  const tenantModelOptions: TenancyModelOptions = {
    actorId: 10,
    tenantId: 1,
  };

  before(async () => {
    const connectionOptions = await setupSingleTestingConnection('postgres', {
      entities: [__dirname + '/entity/*{.js,.ts}'],
      dropSchema: true,
      schemaCreate: true,
    });

    originalConnection = await createConnection(connectionOptions);
    connection = new RLSConnection(originalConnection, tenantModelOptions);
  });
  beforeEach(() => reloadTestingDatabases([connection]));
  after(() => closeTestingConnections([originalConnection]));

  it('should be instance of RLSConnection', () => {
    expect(connection).to.be.instanceOf(RLSConnection);
  });

  it('should not be singleton instance', () => {
    expect(connection).to.not.equal(
      new RLSConnection(originalConnection, tenantModelOptions),
    );
  });

  it('should have the tenant and actor set', () => {
    expect(connection).to.have.property('actorId').and.to.be.equal(10);
    expect(connection).to.have.property('tenantId').and.to.be.equal(1);
  });

  it('should not have the same manager', () => {
    // https://github.com/mochajs/mocha/issues/1624
    try {
      expect(connection.manager).to.not.deep.equal(originalConnection.manager);
    } catch (e) {
      e.showDiff = false;
      throw e;
    }
  });

  it('should not have the same driver', () => {
    // https://github.com/mochajs/mocha/issues/1624
    try {
      expect(connection.driver).to.not.deep.equal(originalConnection.driver);
    } catch (e) {
      e.showDiff = false;
      throw e;
    }
  });

  it('should have all the other properties and be unchanged', () => {
    const keys = [
      'name',
      'options',
      'isConnected',
      'namingStrategy',
      'migrations',
      'subscribers',
      'entityMetadatas',
      'queryResultCache',
      'relationLoader',
      'relationIdLoader',
    ];
    for (const key of keys) {
      expect(connection).to.have.property(key, originalConnection[key]);
    }
  });

  it('should save and return the Post', async () => {
    const post = Post.create();
    post.title = 'Foo';
    post.tenantId = tenantModelOptions.tenantId as number;
    post.userId = tenantModelOptions.actorId as number;
    await post.save();

    const loadedPost = await Post.findOne(post.id);

    loadedPost.should.be.instanceOf(Post);
    loadedPost.id.should.be.eql(post.id);
    loadedPost.title.should.be.eql('Foo');
  });

  describe('#close', () => {
    it('throw error if trying to close connection on RLSConnection instance', async () => {
      const tempConnection = new RLSConnection(
        originalConnection,
        tenantModelOptions,
      );
      expect(tempConnection.close).to.throw;
      expect(tempConnection.isConnected).to.be.true;
      expect(originalConnection.isConnected).to.be.true;
      expect((originalConnection.driver as PostgresDriver).master.ending).to.be
        .false;
    });
  });
});