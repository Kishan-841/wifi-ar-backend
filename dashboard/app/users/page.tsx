import { redirect } from 'next/navigation';

import { deleteUserAction } from '../actions';
import { fetchUsers, getSession } from '@/lib/scans';
import CreateUserForm from './CreateUserForm';

export default async function UsersPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  if (session.user.role !== 'admin') redirect('/');
  const users = await fetchUsers(session.token);

  return (
    <main className="wrap">
      <h1>Users</h1>
      <CreateUserForm />
      <table className="roomTable">
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Scans</th>
            <th>Homes</th>
            <th>Since</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>{u.name}</td>
              <td>{u.email}</td>
              <td>{u.role}</td>
              <td>{u.scanCount}</td>
              <td>{u.layoutCount}</td>
              <td>{new Date(u.createdAt).toLocaleDateString()}</td>
              <td>
                {u.role !== 'admin' && (
                  <form action={deleteUserAction}>
                    <input type="hidden" name="id" value={u.id} />
                    <button type="submit" className="danger">
                      Delete
                    </button>
                  </form>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="scanMeta">Deleting a user also deletes their scans, homes and sessions.</p>
    </main>
  );
}
