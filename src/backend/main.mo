import Map "mo:core/Map";
import Iter "mo:core/Iter";
import Text "mo:core/Text";
import Int "mo:core/Int";
import Principal "mo:core/Principal";
import Array "mo:core/Array";
import List "mo:core/List";
import AccessControl "authorization/access-control";
import Runtime "mo:core/Runtime";
import Nat "mo:core/Nat";
import Time "mo:core/Time";


import MixinAuthorization "authorization/MixinAuthorization";

actor {
  // Hardcoded password for authentication
  let hardcodedPassword = "swh1400";

  // Prefix constants
  let prefixDualBand = "55V";
  let prefixTriBand = "55Y";
  let prefixNewDualBand = "72V";

  // Persistent counter keys
  let counterDualBand = "dualBandCounter";
  let counterTriBand = "triBandCounter";
  let counterNewDualBand = "newDualBandCounter";

  // Session management for password-based authentication
  let authenticatedSessions = Map.empty<Principal, Bool>();

  // User Profile Type
  public type UserProfile = {
    name : Text;
    role : Text;
  };

  // Label Configuration Type
  public type LabelConfig = {
    width : Nat;
    height : Nat;
    margin : Nat;
    barcodeType : Text;
    customText : Text;
    textSize : Nat;
    font : Text;
    barcodePositionX : Nat;
    barcodePositionY : Nat;
    textPositionX : Nat;
    textPositionY : Nat;
    barcodeHeight : Nat;
    barcodeWidthScale : Nat;
    horizontalSpacing : Nat;
    centerContents : Bool;
  };

  // Printer Type
  public type Printer = {
    name : Text;
    connectionType : Text;
    status : Text;
  };

  // Print Record Type
  public type PrintRecord = {
    timestamp : Int;
    serialNumber : Text;
    labelType : Text;
    printer : Text;
  };

  // Error Log Type
  public type ErrorLog = {
    timestamp : Int;
    errorMessage : Text;
    printer : ?Text;
  };

  // App State
  let accessControlState = AccessControl.initState();
  include MixinAuthorization(accessControlState);

  let userProfiles = Map.empty<Principal, UserProfile>();
  let labelConfigs = Map.empty<Text, LabelConfig>();
  let printers = Map.empty<Text, Printer>();
  var printHistory : [PrintRecord] = [];
  var errorLogs : [ErrorLog] = [];
  let labelCounters = Map.empty<Text, Nat>();

  var prefixesList = List.empty<Text>();

  public type TitleMapping = {
    prefix : Text;
    title : Text;
  };

  var titleMappingsList = List.empty<TitleMapping>();

  // Helper function to check if caller is authenticated via password
  private func isPasswordAuthenticated(caller : Principal) : Bool {
    switch (authenticatedSessions.get(caller)) {
      case (null) { false };
      case (?authenticated) { authenticated };
    };
  };

  // Helper function to require password authentication
  private func requirePasswordAuth(caller : Principal) {
    if (not isPasswordAuthenticated(caller)) {
      Runtime.trap("Unauthorized: Authentication required");
    };
  };

  // Helper function to require user permission (authenticated + user role)
  private func requireUserPermission(caller : Principal) {
    requirePasswordAuth(caller);
    if (not (AccessControl.hasPermission(accessControlState, caller, #user))) {
      Runtime.trap("Unauthorized: Only users can perform this action");
    };
  };

  // Helper function to require admin permission
  private func requireAdminPermission(caller : Principal) {
    requirePasswordAuth(caller);
    if (not (AccessControl.hasPermission(accessControlState, caller, #admin))) {
      Runtime.trap("Unauthorized: Only admins can perform this action");
    };
  };

  public query ({ caller }) func health() : async Bool {
    true;
  };

  public shared ({ caller }) func authenticate(password : Text) : async Bool {
    if (password == hardcodedPassword) {
      authenticatedSessions.add(caller, true);
      true;
    } else {
      false;
    };
  };

  public query ({ caller }) func isAuthenticatedQuery() : async Bool {
    isPasswordAuthenticated(caller);
  };

  public query ({ caller }) func getCallerUserProfile() : async ?UserProfile {
    requireUserPermission(caller);
    userProfiles.get(caller);
  };

  public query ({ caller }) func getUserProfile(user : Principal) : async ?UserProfile {
    requireUserPermission(caller);
    if (caller != user and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Can only view your own profile");
    };
    userProfiles.get(user);
  };

  public shared ({ caller }) func saveCallerUserProfile(profile : UserProfile) : async () {
    requireUserPermission(caller);
    userProfiles.add(caller, profile);
  };

  // Label Configuration Management - Admin only for modifications, users can read
  public shared ({ caller }) func saveLabelConfig(name : Text, config : LabelConfig) : async () {
    requireAdminPermission(caller);
    labelConfigs.add(name, config);
  };

  public query ({ caller }) func getLabelConfig(name : Text) : async LabelConfig {
    requireUserPermission(caller);
    switch (labelConfigs.get(name)) {
      case (null) { Runtime.trap("Config does not exist") };
      case (?config) { config };
    };
  };

  public query ({ caller }) func getAllLabelConfigs() : async [LabelConfig] {
    requireUserPermission(caller);
    labelConfigs.values().toArray();
  };

  public query ({ caller }) func getLabelConfigPreview(name : Text) : async LabelConfig {
    requireUserPermission(caller);
    switch (labelConfigs.get(name)) {
      case (null) { Runtime.trap("Config does not exist") };
      case (?config) { config };
    };
  };

  public query ({ caller }) func getAllLabelConfigsPreview() : async [LabelConfig] {
    requireUserPermission(caller);
    labelConfigs.values().toArray();
  };

  // Printer Management - Admin only
  public shared ({ caller }) func addPrinter(name : Text, connectionType : Text) : async () {
    requireAdminPermission(caller);
    let printer : Printer = {
      name;
      connectionType;
      status = "disconnected";
    };
    printers.add(name, printer);
  };

  public shared ({ caller }) func updatePrinterStatus(name : Text, status : Text) : async () {
    requireAdminPermission(caller);
    switch (printers.get(name)) {
      case (null) { Runtime.trap("Printer does not exist") };
      case (?printer) {
        let updatedPrinter : Printer = {
          name = printer.name;
          connectionType = printer.connectionType;
          status;
        };
        printers.add(name, updatedPrinter);
      };
    };
  };

  public query ({ caller }) func getPrinter(name : Text) : async Printer {
    requireUserPermission(caller);
    switch (printers.get(name)) {
      case (null) { Runtime.trap("Printer does not exist") };
      case (?printer) { printer };
    };
  };

  public query ({ caller }) func getAllPrinters() : async [Printer] {
    requireUserPermission(caller);
    printers.values().toArray();
  };

  // Print Records - Users can add, all can view
  public shared ({ caller }) func addPrintRecord(serialNumber : Text, labelType : Text, printer : Text) : async () {
    requireUserPermission(caller);
    let record : PrintRecord = {
      timestamp = Time.now();
      serialNumber;
      labelType;
      printer;
    };
    printHistory := printHistory.concat([record]);
  };

  public query ({ caller }) func getAllPrintRecords() : async [PrintRecord] {
    requireUserPermission(caller);
    printHistory;
  };

  // Error Logs - Users can add, all can view
  public shared ({ caller }) func addErrorLog(errorMessage : Text, printer : ?Text) : async () {
    requireUserPermission(caller);
    let log : ErrorLog = {
      timestamp = Time.now();
      errorMessage;
      printer;
    };
    errorLogs := errorLogs.concat([log]);
  };

  public query ({ caller }) func getAllErrorLogs() : async [ErrorLog] {
    requireUserPermission(caller);
    errorLogs;
  };

  // Counter Functions - Users can read and increment, admins can reset
  public query ({ caller }) func getLabelCount(labelType : Text) : async Nat {
    requireUserPermission(caller);
    switch (labelCounters.get(labelType)) {
      case (null) { 0 };
      case (?count) { count };
    };
  };

  public shared ({ caller }) func incrementLabelCounter(prefix : Text) : async Nat {
    requireUserPermission(caller);

    if (not isValidPrefixInternal(prefix)) {
      Runtime.trap("Error: Serial does not match prefix requirements");
    };

    let labelType = getLabelTypeByPrefixInternal(prefix);
    switch (labelType) {
      case (null) { Runtime.trap("Unknown prefix: " # prefix) };
      case (?labelType) {
        let currentCount = switch (labelCounters.get(labelType)) {
          case (null) { 0 };
          case (?count) { count };
        };
        let newCount = currentCount + 1;
        labelCounters.add(labelType, newCount);
        newCount;
      };
    };
  };

  public query ({ caller }) func getAllCounters() : async [(Text, Nat)] {
    requireUserPermission(caller);
    let entries = labelCounters.entries().toArray();
    entries.map<(Text, Nat), (Text, Nat)>(
      func((key, value)) { (key, value) }
    );
  };

  public shared ({ caller }) func resetAllCounters() : async () {
    requireAdminPermission(caller);
    labelCounters.clear();
  };

  public shared ({ caller }) func clearPrintHistory() : async () {
    requireAdminPermission(caller);
    printHistory := [];
  };

  public shared ({ caller }) func clearErrorLogs() : async () {
    requireAdminPermission(caller);
    errorLogs := [];
  };

  // Prefix Management - Admin only
  public shared ({ caller }) func setPrefixes(newPrefixes : [Text]) : async () {
    requireAdminPermission(caller);
    prefixesList.clear();
    prefixesList.addAll(newPrefixes.values());
  };

  public query ({ caller }) func getPrefixes() : async [Text] {
    requireUserPermission(caller);
    prefixesList.toArray();
  };

  public query ({ caller }) func validateBarcode(barcode : Text) : async Bool {
    requireUserPermission(caller);
    isValidPrefixInternal(barcode);
  };

  public shared ({ caller }) func addSinglePrefix(prefix : Text) : async () {
    requireAdminPermission(caller);
    let trimmedPrefix = prefix.trim(#char(' '));
    if (trimmedPrefix.size() > 0) {
      prefixesList.add(trimmedPrefix);
    };
  };

  public shared ({ caller }) func removeSpecificPrefix(prefixToRemove : Text) : async () {
    requireAdminPermission(caller);
    let trimmedToRemove = prefixToRemove.trim(#char(' '));
    let filteredPrefixes = prefixesList.filter(
      func(prefix) {
        let trimmedPrefix = prefix.trim(#char(' '));
        trimmedPrefix.size() > 0 and trimmedPrefix != trimmedToRemove
      }
    );
    prefixesList.clear();
    prefixesList.addAll(filteredPrefixes.values());
  };

  // Title Mapping - Users can read, admins can modify
  public query ({ caller }) func getTitleByPrefix(prefix : Text) : async ?Text {
    requireUserPermission(caller);
    for (mapping in titleMappingsList.values()) {
      if (prefix.startsWith(#text (mapping.prefix))) {
        return ?mapping.title;
      };
    };
    null;
  };

  public shared ({ caller }) func addTitleMapping(prefix : Text, title : Text) : async () {
    requireAdminPermission(caller);
    titleMappingsList.add({
      prefix;
      title;
    });
  };

  public query ({ caller }) func getAllTitleMappings() : async [TitleMapping] {
    requireUserPermission(caller);
    titleMappingsList.toArray();
  };

  public shared ({ caller }) func removeTitleMapping(prefixToRemove : Text) : async () {
    requireAdminPermission(caller);
    let filteredMappings = titleMappingsList.filter(
      func(mapping) { mapping.prefix != prefixToRemove }
    );
    titleMappingsList.clear();
    titleMappingsList.addAll(filteredMappings.values());
  };

  public shared ({ caller }) func initializeDefaultTitles() : async () {
    requireAdminPermission(caller);

    titleMappingsList.clear();
    titleMappingsList.add({
      prefix = prefixDualBand;
      title = "Dual Band";
    });
    titleMappingsList.add({
      prefix = prefixNewDualBand;
      title = "New Version Dual Band";
    });
    titleMappingsList.add({
      prefix = prefixTriBand;
      title = "Tri Band";
    });
  };

  // Returns label type internal identifier by prefix
  private func getLabelTypeByPrefixInternal(prefix : Text) : ?Text {
    if (prefix.startsWith(#text prefixDualBand)) { ?counterDualBand }
    else if (prefix.startsWith(#text prefixTriBand)) { ?counterTriBand }
    else if (prefix.startsWith(#text prefixNewDualBand)) { ?counterNewDualBand } else {
      for (mapping in titleMappingsList.values()) {
        if (prefix.startsWith(#text (mapping.prefix))) {
          return ?mapping.title;
        };
      };
      null;
    };
  };

  private func isValidPrefixInternal(testPrefix : Text) : Bool {
    for (prefix in prefixesList.values()) {
      let trimmedPrefix = prefix.trim(#char(' '));
      if (trimmedPrefix.size() > 0 and testPrefix.startsWith(#text (trimmedPrefix))) {
        return true;
      };
    };
    false;
  };

  public query ({ caller }) func getLabelTypeByPrefix(prefix : Text) : async ?Text {
    requireUserPermission(caller);
    getLabelTypeByPrefixInternal(prefix);
  };

  public shared ({ caller }) func logout() : async () {
    requirePasswordAuth(caller);
    authenticatedSessions.remove(caller);
  };
};
