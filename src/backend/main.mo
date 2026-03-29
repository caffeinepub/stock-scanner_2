import Map "mo:core/Map";
import Text "mo:core/Text";
import Set "mo:core/Set";
import Runtime "mo:core/Runtime";
import Principal "mo:core/Principal";

actor {
  let watchlists = Map.empty<Principal, Set.Set<Text>>();

  func getOrCreateWatchlist(user : Principal) : Set.Set<Text> {
    switch (watchlists.get(user)) {
      case (null) { Runtime.trap("User not registered") };
      case (?watchlist) { watchlist };
    };
  };

  public shared ({ caller }) func addToWatchlist(ticker : Text) : async () {
    let watchlist = switch (watchlists.get(caller)) {
      case (null) { Set.empty<Text>() };
      case (?existing) { existing };
    };
    watchlist.add(ticker);
    watchlists.add(caller, watchlist);
  };

  public shared ({ caller }) func removeFromWatchlist(ticker : Text) : async () {
    let watchlist = getOrCreateWatchlist(caller);
    watchlist.remove(ticker);
  };
};
