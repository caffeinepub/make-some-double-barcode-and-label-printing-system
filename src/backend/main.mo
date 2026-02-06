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
import Migration "migration";

(with migration = Migration.run)
actor {
  // Hardcoded password for authentication
  let hardcodedPassword = "swh1400";
  let v72LabelKey = "newDual72VLabels";

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
    // Added for layout persistence
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

  // Prefixes as List<Text> for manipulation
  var prefixesList = List.empty<Text>();

  // Title Mapping Type
  public type TitleMapping = {
    prefix : Text;
    title : Text;
  };

  // Store title mappings
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

  // Health check endpoint
  public query ({ caller }) func health() : async Bool {
    true;
  };

  // Authentication function - accepts anonymous calls and creates session on success
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

  // User Profile Management - requires password authentication
  public query ({ caller }) func getCallerUserProfile() : async ?UserProfile {
    requirePasswordAuth(caller);
    userProfiles.get(caller);
  };

  public query ({ caller }) func getUserProfile(user : Principal) : async ?UserProfile {
    requirePasswordAuth(caller);
    if (caller != user and not AccessControl.isAdmin(accessControlState, caller)) {
      Runtime.trap("Unauthorized: Can only view your own profile");
    };
    userProfiles.get(user);
  };

  public shared ({ caller }) func saveCallerUserProfile(profile : UserProfile) : async () {
    requirePasswordAuth(caller);
    userProfiles.add(caller, profile);
  };

  // Label Configuration Management
  public shared ({ caller }) func saveLabelConfig(name : Text, config : LabelConfig) : async () {
    requirePasswordAuth(caller);
    labelConfigs.add(name, config);
  };

  public query ({ caller }) func getLabelConfig(name : Text) : async LabelConfig {
    requirePasswordAuth(caller);
    switch (labelConfigs.get(name)) {
      case (null) { Runtime.trap("Config does not exist") };
      case (?config) { config };
    };
  };

  public query ({ caller }) func getAllLabelConfigs() : async [LabelConfig] {
    requirePasswordAuth(caller);
    labelConfigs.values().toArray();
  };

  // Printer Management
  public shared ({ caller }) func addPrinter(name : Text, connectionType : Text) : async () {
    requirePasswordAuth(caller);
    let printer : Printer = {
      name;
      connectionType;
      status = "disconnected";
    };
    printers.add(name, printer);
  };

  public shared ({ caller }) func updatePrinterStatus(name : Text, status : Text) : async () {
    requirePasswordAuth(caller);
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
    requirePasswordAuth(caller);
    switch (printers.get(name)) {
      case (null) { Runtime.trap("Printer does not exist") };
      case (?printer) { printer };
    };
  };

  public query ({ caller }) func getAllPrinters() : async [Printer] {
    requirePasswordAuth(caller);
    printers.values().toArray();
  };

  // Print Records
  public shared ({ caller }) func addPrintRecord(serialNumber : Text, labelType : Text, printer : Text) : async () {
    requirePasswordAuth(caller);
    let record : PrintRecord = {
      timestamp = Time.now();
      serialNumber;
      labelType;
      printer;
    };
    printHistory := printHistory.concat([record]);
  };

  public query ({ caller }) func getAllPrintRecords() : async [PrintRecord] {
    requirePasswordAuth(caller);
    printHistory;
  };

  // Error Logs
  public shared ({ caller }) func addErrorLog(errorMessage : Text, printer : ?Text) : async () {
    requirePasswordAuth(caller);
    let log : ErrorLog = {
      timestamp = Time.now();
      errorMessage;
      printer;
    };
    errorLogs := errorLogs.concat([log]);
  };

  public query ({ caller }) func getAllErrorLogs() : async [ErrorLog] {
    requirePasswordAuth(caller);
    errorLogs;
  };

  // Counter Functions for New Dual (72V) Labels
  public shared ({ caller }) func incrementNewDualLabelCount() : async Nat {
    requirePasswordAuth(caller);
    let currentCount = switch (labelCounters.get(v72LabelKey)) {
      case (null) { 0 };
      case (?count) { count };
    };
    let newCount = currentCount + 1;
    labelCounters.add(v72LabelKey, newCount);
    newCount;
  };

  public query ({ caller }) func getNewDualLabelCount() : async Nat {
    requirePasswordAuth(caller);
    switch (labelCounters.get(v72LabelKey)) {
      case (null) { 0 };
      case (?count) { count };
    };
  };

  // Reset all counters
  public shared ({ caller }) func resetAllCounters() : async () {
    requirePasswordAuth(caller);
    labelCounters.clear();
  };

  // Clear print history - requires password authentication
  public shared ({ caller }) func clearPrintHistory() : async () {
    requirePasswordAuth(caller);
    printHistory := [];
  };

  // Clear error logs - requires password authentication
  public shared ({ caller }) func clearErrorLogs() : async () {
    requirePasswordAuth(caller);
    errorLogs := [];
  };

  // Prefix Validation Module

  // Set prefixes (comma-separated or multiline)
  public shared ({ caller }) func setPrefixes(newPrefixes : [Text]) : async () {
    requirePasswordAuth(caller);
    prefixesList.clear();
    prefixesList.addAll(newPrefixes.values());
  };

  public query ({ caller }) func getPrefixes() : async [Text] {
    requirePasswordAuth(caller);
    prefixesList.toArray();
  };

  // Validate a scanned barcode using prefixes
  public query ({ caller }) func validateBarcode(barcode : Text) : async Bool {
    requirePasswordAuth(caller);

    for (prefix in prefixesList.values()) {
      let trimmedPrefix = prefix.trim(#char(' '));
      if (trimmedPrefix.size() > 0 and barcode.startsWith(#text (trimmedPrefix))) {
        return true;
      };
    };
    false;
  };

  // Add single prefix
  public shared ({ caller }) func addSinglePrefix(prefix : Text) : async () {
    requirePasswordAuth(caller);
    let trimmedPrefix = prefix.trim(#char(' '));
    if (trimmedPrefix.size() > 0) {
      prefixesList.add(trimmedPrefix);
    };
  };

  // Remove specific prefix
  public shared ({ caller }) func removeSpecificPrefix(prefixToRemove : Text) : async () {
    requirePasswordAuth(caller);
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

  // Title Mapping Management

  public query ({ caller }) func getTitleByPrefix(prefix : Text) : async ?Text {
    requirePasswordAuth(caller);
    for (mapping in titleMappingsList.values()) {
      if (prefix.startsWith(#text (mapping.prefix))) {
        return ?mapping.title;
      };
    };
    null;
  };

  public shared ({ caller }) func addTitleMapping(prefix : Text, title : Text) : async () {
    requirePasswordAuth(caller);
    titleMappingsList.add({
      prefix;
      title;
    });
  };

  public query ({ caller }) func getAllTitleMappings() : async [TitleMapping] {
    requirePasswordAuth(caller);
    titleMappingsList.toArray();
  };

  public shared ({ caller }) func removeTitleMapping(prefixToRemove : Text) : async () {
    requirePasswordAuth(caller);
    let filteredMappings = titleMappingsList.filter(
      func(mapping) { mapping.prefix != prefixToRemove }
    );
    titleMappingsList.clear();
    titleMappingsList.addAll(filteredMappings.values());
  };

  // Helper function to initialize default title mappings
  public shared ({ caller }) func initializeDefaultTitles() : async () {
    requirePasswordAuth(caller);

    titleMappingsList.clear();
    titleMappingsList.add({
      prefix = "55V";
      title = "Dual Band";
    });
    titleMappingsList.add({
      prefix = "72V";
      title = "New Version Dual Band";
    });
    titleMappingsList.add({
      prefix = "55Y";
      title = "Tri Band";
    });
  };

  // Logout function to clear session
  public shared ({ caller }) func logout() : async () {
    authenticatedSessions.remove(caller);
  };
};
