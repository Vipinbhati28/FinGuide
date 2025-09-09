import React, { useContext, useState } from 'react';
import { SIDE_MENU_DATA } from '../../utils/data';
import { UserContext } from '../../context/UserContext';
import { useNavigate } from "react-router-dom";
import CharAvatar from "../../components/Cards/CharAvatar";
import axiosInstance from "../../utils/axiosInstance";
import { API_PATHS } from "../../utils/apiPaths";
import { LuUser } from "react-icons/lu";

const SideMenu = ({ activeMenu }) => {
  const { user, clearUser, updateUser } = useContext(UserContext);
  const navigate = useNavigate();
  const [showConfirm, setShowConfirm] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [name, setName] = useState(user?.fullName || "");
  const [busy, setBusy] = useState(false);

  const handleClick = (route) => {
    if (route === "logout") {
      setShowConfirm(true);
      return;
    }

    navigate(route);
  };

  const handleLogout = () => {
    localStorage.clear();
    clearUser();
    navigate("/login");
  };

  const saveProfile = async () => {
    if (!name) return;
    setBusy(true);
    try {
      const res = await axiosInstance.put(API_PATHS.AUTH.UPDATE, { fullName: name });
      updateUser(res.data);
      setShowProfile(false);
    } catch (e) {
      console.error('Profile update failed', e);
    } finally { setBusy(false); }
  };

  const deleteAccount = async () => {
    if (!confirm('Are you sure you want to delete your account? This cannot be undone.')) return;
    try {
      await axiosInstance.delete(API_PATHS.AUTH.DELETE);
      handleLogout();
    } catch (e) {
      console.error('Delete failed', e);
    }
  };


  return (
    <div className="w-64 h-[calc(100vh-61px)] bg-white border-r border-gray-200/50 p-4 lg:p-5 sticky top-[61px] z-20 overflow-y-auto">
      <div className="flex flex-col items-center justify-center gap-3 mt-3 mb-7">
        <CharAvatar
          fullName={user?.fullName}
          width="w-20"
          height="h-20"
          style="text-xl"
        />

        <h5 className="text-gray-950 font-medium leading-6 text-center">
          Welcome, {user?.fullName || ""}
        </h5>
      </div>

      {SIDE_MENU_DATA.map((item, index) => (
        <button
          key={`menu_${index}`}
          className={`w-full flex items-center gap-4 text-[15px] ${activeMenu === item.label ? "text-white bg-primary" : ""
            } py-3 px-6 rounded-lg mb-3`}
          onClick={() => handleClick(item.path)}
        >
          <item.icon className="text-xl" />
          {item.label}
        </button>
      ))}

      <div className="mt-2 grid gap-2">
        <button className="w-full text-[15px] py-3 px-6 rounded-lg border border-gray-200/50 flex items-center gap-3" onClick={() => { setName(user?.fullName || ''); setShowProfile(true); }}>
          <LuUser className="text-xl" />
          Profile
        </button>
      </div>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowConfirm(false)}></div>
          <div className="relative bg-white rounded-lg shadow-xl w-11/12 max-w-sm p-5">
            <h4 className="text-lg font-semibold mb-2">Confirm Logout</h4>
            <p className="text-sm text-slate-600 mb-4">Are you sure you want to logout?</p>
            <div className="flex justify-end gap-2">
              <button className="chip" onClick={() => setShowConfirm(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleLogout}>Logout</button>
            </div>
          </div>
        </div>
      )}

      {showProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowProfile(false)}></div>
          <div className="relative bg-white rounded-lg shadow-xl w-11/12 max-w-sm p-5">
            <h4 className="text-lg font-semibold mb-3">Edit Profile</h4>
            <div className="grid gap-3">
              <input className="input" placeholder="Full Name" value={name} onChange={e => setName(e.target.value)} />
              <div className="flex justify-between gap-2">
                <button className="chip flex-1" onClick={() => setShowProfile(false)}>Cancel</button>
                <button disabled={busy} className="btn-primary flex-1" onClick={saveProfile}>{busy ? 'Saving...' : 'Save'}</button>
              </div>
              <button className="w-full text-sm text-red-600 border border-red-200 rounded-md py-2" onClick={deleteAccount}>Delete Account</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SideMenu;
